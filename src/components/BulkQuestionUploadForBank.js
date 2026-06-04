"use client";

import { useState } from "react";
import { Upload, Download, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { sanitizeHtml } from "../lib/sanitize";
import { parseQuestions } from "../lib/questionParser";
import RichTextEditor from "./RichTextEditor";

function validateParsed(questions) {
  const errors = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.questionText?.trim()) errors.push(`Question ${i + 1}: Question text is required`);
    else if (!q.correctAnswer || !["A", "B", "C", "D"].includes(q.correctAnswer)) errors.push(`Question ${i + 1}: Valid correct answer (A-D) is required`);
    else if (!q.options || q.options.length < 2) errors.push(`Question ${i + 1}: At least 2 options are required`);
  }
  return errors;
}

const TEMPLATE = `Which city is home to the Brandenburg Gate?
A: Vienna
B: Zurich
C: Berlin
D: Munich
ANSWER: C

What is the capital of Australia?
A: Sydney
B: Canberra
C: Melbourne
D: Perth
ANSWER: B`;

export default function BulkQuestionUploadForBank({ questionBankId, onUploadComplete }) {
  const [questionText, setQuestionText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [useRichEditor, setUseRichEditor] = useState(false);
  const { showError, showSuccess } = useMessages();

  const parsed = questionText.trim() ? parseQuestions(questionText) : [];
  const validationErrors = parsed.length > 0 ? validateParsed(parsed) : [];
  const canUpload = parsed.length > 0 && validationErrors.length === 0;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setQuestionText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions_template.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!canUpload || !questionBankId) return;
    setIsUploading(true);
    try {
      const res = await fetch(`/api/question-banks/${questionBankId}/questions/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionText: questionText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || `${data.count} question(s) uploaded. Default mark is 1 per question.`);
        setQuestionText("");
        onUploadComplete?.();
      } else {
        showError(data.error || (data.errors?.length ? data.errors.join(" ") : "Upload failed"));
      }
    } catch (err) {
      showError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Upload Questions</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            Attach file
            <input type="file" accept=".txt,text/plain" onChange={handleFileChange} className="hidden" />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paste or type questions (template format)</label>
          {useRichEditor ? (
            <div className="border border-gray-300 rounded-lg">
              <RichTextEditor value={questionText} onChange={setQuestionText} placeholder="Paste questions here..." height={300} disabled={isUploading} />
            </div>
          ) : (
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Paste your questions in the template format..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 resize-none"
              disabled={isUploading}
            />
          )}
          <button
            type="button"
            onClick={() => setUseRichEditor(!useRichEditor)}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {useRichEditor ? "Switch to plain text" : "Use rich text"}
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p><strong>Format:</strong> One question per block. First line = question text. Then A: / B: / C: / D: options (colon or period), ANSWER: [letter]. Optional POINTS: [number] (default 1). Separate questions with a blank line.</p>
        </div>
        {parsed.length > 0 && (
          <div className={validationErrors.length > 0 ? "bg-red-50 border border-red-200 rounded-lg p-4" : "bg-green-50 border border-green-200 rounded-lg p-4"}>
            <h4 className="text-sm font-medium mb-2">
              {validationErrors.length > 0 ? `Preview: ${parsed.length} question(s) — fix errors before upload` : `Preview: ${parsed.length} question(s) ready to upload`}
            </h4>
            {validationErrors.length > 0 ? (
              <ul className="space-y-1 text-sm text-red-700">
                {validationErrors.map((err, i) => (
                  <li key={i} className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{err}</li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {parsed.slice(0, 5).map((q, i) => (
                  <div key={i} className="text-sm text-green-800">
                    <span className="font-medium">Q{i + 1}: </span>
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml((q.questionText || "").slice(0, 80)) }} />…
                    <span className="text-green-600"> Answer: {q.correctAnswer} · Points: {q.points ?? 1}</span>
                  </div>
                ))}
                {parsed.length > 5 && <p className="text-xs text-green-700">… and {parsed.length - 5} more</p>}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload || isUploading}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Uploading..." : "Confirm & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
