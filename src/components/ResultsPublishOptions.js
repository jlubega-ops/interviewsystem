"use client";

import { applyCascadeChange } from "../lib/resultsPublish";

export default function ResultsPublishOptions({ value, onChange, disabled }) {
  const handleChange = (key, checked) => {
    onChange(applyCascadeChange(value, key, checked));
  };

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={value.showScore}
          disabled={disabled}
          onChange={(e) => handleChange("showScore", e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-gray-900">
            Display score
          </span>
          <span className="block text-xs text-gray-600">
            Candidates only see a summary such as 2/20. No question or attempt
            details.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={value.showAttempt}
          disabled={disabled}
          onChange={(e) => handleChange("showAttempt", e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-gray-900">
            Publish question attempt
          </span>
          <span className="block text-xs text-gray-600">
            Also turns on the score summary. Candidates see the questions and
            the answers they submitted.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={value.showCorrect}
          disabled={disabled}
          onChange={(e) => handleChange("showCorrect", e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-gray-900">
            Display correct answers
          </span>
          <span className="block text-xs text-gray-600">
            Also turns on the score and attempt details. Candidates see the
            correct option for each question.
          </span>
        </span>
      </label>
    </div>
  );
}
