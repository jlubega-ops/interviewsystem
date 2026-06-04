"use client";

import TiptapEditor from "./TiptapEditor";

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Enter text...",
  height = 300,
  disabled = false,
}) {
  return (
    <div className="rich-text-editor" style={{ minHeight: height }}>
      <TiptapEditor
        content={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}
