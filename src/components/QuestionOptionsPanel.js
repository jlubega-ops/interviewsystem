"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { htmlToPlainText } from "../lib/sanitize";
import {
  getQuestionOptions,
  normalizeOptionLetter,
} from "../lib/questionOptions";

export default function QuestionOptionsPanel({
  options,
  correctAnswer,
  candidateAnswer,
  showCorrect = true,
  expanded,
  onToggle,
}) {
  const opts = getQuestionOptions({ options });
  if (!opts.length) return null;

  const correctLetter = normalizeOptionLetter(correctAnswer);
  const candidateLetter = normalizeOptionLetter(candidateAnswer);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        {expanded ? "Hide options" : "Show options"}
      </button>
      {expanded ? (
        <ul className="mt-1.5 space-y-1">
          {opts.map((opt, index) => {
            const letter = String(opt?.letter || "").trim().toUpperCase();
            const isCorrect = showCorrect && letter && letter === correctLetter;
            const isCandidate =
              candidateLetter && letter && letter === candidateLetter;
            return (
              <li
                key={letter || index}
                className={`text-xs px-2 py-1 rounded flex gap-2 ${
                  isCorrect
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : isCandidate
                      ? "bg-red-50 text-red-800 border border-red-100"
                      : "text-gray-700 bg-gray-50"
                }`}
              >
                <span className="font-semibold w-4 shrink-0">{letter || "—"}</span>
                <span className="min-w-0">{htmlToPlainText(opt?.text || "")}</span>
                {isCorrect ? (
                  <span className="ml-auto font-medium">Correct</span>
                ) : isCandidate ? (
                  <span className="ml-auto">Chosen</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
