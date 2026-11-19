import { htmlToPlainText } from "./sanitize";

export function normalizeOptionLetter(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^[A-Z]$/i.test(raw)) return raw.slice(0, 1).toUpperCase();
  return raw.toUpperCase().slice(0, 1);
}

export function getQuestionOptions(question) {
  return Array.isArray(question?.options) ? question.options : [];
}

export function resolveCorrectLetter(question) {
  const raw = (question?.correctAnswer ?? "").toString().trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const options = getQuestionOptions(question);
  if (/^[A-Z]$/i.test(upper)) return upper.slice(0, 1);
  const byText = options.find(
    (opt) =>
      opt &&
      typeof opt.text === "string" &&
      opt.text.trim().toLowerCase() === raw.toLowerCase()
  );
  if (byText && typeof byText.letter === "string") {
    return byText.letter.trim().toUpperCase();
  }
  return upper.slice(0, 1);
}

export function formatOptionsLine(options) {
  return getQuestionOptions({ options })
    .map((opt) => {
      const letter = String(opt?.letter || "").trim().toUpperCase();
      const text = htmlToPlainText(opt?.text || "");
      return letter ? `${letter}) ${text}` : text;
    })
    .filter(Boolean)
    .join(" | ");
}
