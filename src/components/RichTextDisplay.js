"use client";

import { htmlToPlainText, sanitizeHtml } from "../lib/sanitize";

export default function RichTextDisplay({ html, className = "text-gray-600" }) {
  if (!html) return null;
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }
  const text = htmlToPlainText(html);
  if (!text) return null;
  return <p className={className}>{text}</p>;
}
