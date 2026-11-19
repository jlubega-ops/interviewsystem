"use client";

import { parseInstructionList } from "../lib/cohortInstructions";

export default function InstructionListDisplay({ html }) {
  const items = parseInstructionList(html, { fallbackDefaults: true });
  if (!items.length) return null;

  return (
    <section className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900 mb-2">
        You must read these instructions
      </h2>
      <ol className="list-decimal list-outside ml-5 pl-1 space-y-1.5 text-sm text-amber-950">
        {items.map((item, index) => (
          <li key={index} className="leading-snug pl-1">
            {item}
          </li>
        ))}
      </ol>
    </section>
  );
}
