/**
 * Parse questions from text upload.
 * Supports two formats:
 *
 * 1) Block format (question template.txt style):
 *    - Questions separated by blank lines
 *    - First line of each block = question text (no prefix, or optional "QN1 " prefix)
 *    - Options: "A: text" or "A. text" (colon or period)
 *    - Then "ANSWER: C"
 *    - Optional "POINTS: 2"
 *
 * 2) Inline format (legacy):
 *    - "QN1 Question text?" then A. B. C. D. then ANSWER: B then POINTS: 1
 */
function normalizePlainText(text) {
  return (text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const OPTION_REGEX = /^[A-D][:.]\s+/i;
const ANSWER_REGEX = /^ANSWER:\s*/i;
const POINTS_REGEX = /^POINTS:\s*/i;
const QN_PREFIX_REGEX = /^QN\d+\s+/i;

function parseBlock(block) {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  let questionText = "";
  const options = [];
  let correctAnswer = "";
  let points = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ANSWER_REGEX.test(line)) {
      correctAnswer = line.replace(ANSWER_REGEX, "").trim().toUpperCase().slice(0, 1);
      continue;
    }
    if (POINTS_REGEX.test(line)) {
      const n = parseInt(line.replace(POINTS_REGEX, "").trim(), 10);
      if (!Number.isNaN(n) && n >= 0) points = n;
      continue;
    }
    if (OPTION_REGEX.test(line)) {
      const optionText = line.replace(OPTION_REGEX, "").trim();
      options.push(optionText);
      continue;
    }
    // First non-option/answer/points line: question text (strip optional QN1 prefix)
    if (questionText === "" && options.length === 0) {
      questionText = line.replace(QN_PREFIX_REGEX, "").trim();
    }
  }

  if (!questionText.trim()) return null;
  return {
    questionText: questionText.trim(),
    options,
    correctAnswer: correctAnswer || (options.length > 0 ? "A" : ""),
    points: points || 1,
  };
}

/**
 * @param {string} text - Raw paste/file content (may contain HTML)
 * @returns {Array<{ questionText: string, options: string[], correctAnswer: string, points: number }>}
 */
export function parseQuestions(text) {
  const plainText = normalizePlainText(text);
  const blocks = plainText.split(/\n\s*\n/).filter((b) => b.trim());
  const questions = [];
  for (const block of blocks) {
    const q = parseBlock(block);
    if (q && q.questionText) questions.push(q);
  }
  return questions;
}
