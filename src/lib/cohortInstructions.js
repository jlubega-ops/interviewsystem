import { htmlToPlainText } from "./sanitize";

export const DEFAULT_COHORT_INSTRUCTIONS = [
  "Stay on the exam page. Leaving it submits your attempt automatically.",
  "You have one attempt. No retries.",
  "Do not share your login details. Sharing them will disqualify you.",
  "Click Submit to finish. Unsubmitted attempts may not count.",
  "Copying from the internet or from others will disqualify you.",
  "Do not open other apps unless the invigilator allows it.",
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function serializeInstructionList(items) {
  const lis = (items || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  return lis ? `<ol>${lis}</ol>` : "";
}

export function parseInstructionList(html, { fallbackDefaults = false } = {}) {
  const fallback = () =>
    fallbackDefaults ? [...DEFAULT_COHORT_INSTRUCTIONS] : [];
  if (!html || typeof html !== "string") {
    return fallback();
  }

  // Collect items in document order from <li> entries and standalone
  // paragraph/heading/blockquote blocks so mixed content is not dropped.
  const blockRe =
    /<li\b[^>]*>([\s\S]*?)<\/li>|<(p|blockquote|h[1-6])\b[^>]*>([\s\S]*?)<\/\2>/gi;
  const items = [];
  let blockMatch;
  while ((blockMatch = blockRe.exec(html)) !== null) {
    const raw = blockMatch[1] ?? blockMatch[3] ?? "";
    const text = htmlToPlainText(raw).trim();
    if (text) items.push(text);
  }
  if (items.length) return items;

  const text = htmlToPlainText(html).trim();
  if (!text) {
    return fallbackDefaults ? [...DEFAULT_COHORT_INSTRUCTIONS] : [];
  }

  const numbered = text
    .split(/\n+|(?=\d+\.\s)/)
    .map((part) => part.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;
  return [text];
}
