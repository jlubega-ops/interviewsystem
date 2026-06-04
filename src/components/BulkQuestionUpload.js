"use client";

import { useState } from "react";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Copy,
  Edit3,
} from "lucide-react";
import { useMessages } from "./MessageSystem";
import { sanitizeHtml } from "../lib/sanitize";
import { parseQuestions } from "../lib/questionParser";
import RichTextEditor from "./RichTextEditor";

export default function BulkQuestionUpload({ interviewId, onUploadComplete }) {
  const [questionText, setQuestionText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [useRichEditor, setUseRichEditor] = useState(false);
  const { showError, showSuccess } = useMessages();

  const handleTextChange = (event) => {
    setQuestionText(event.target.value);
  };

  const handleUpload = async () => {
    if (!questionText.trim()) {
      showError("Please enter some questions");
      return;
    }

    setIsUploading(true);
    setUploadResults(null);
    setShowResults(false);

    try {
      const response = await fetch("/api/interviews/upload-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interviewId: interviewId,
          questionText: questionText.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResults(result);
        setShowResults(true);
        showSuccess(
          `Upload completed! ${result.successCount} questions processed successfully.`
        );
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        showError(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showError("Failed to upload questions");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Which city is home to the Brandenburg Gate?
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

    const blob = new Blob([template], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "questions_template.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const copyTemplate = () => {
    const template = `Which city is home to the Brandenburg Gate?
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

    navigator.clipboard.writeText(template).then(() => {
      showSuccess("Template copied to clipboard!");
    });
  };

  const resetUpload = () => {
    setUploadResults(null);
    setShowResults(false);
    setQuestionText("");
  };

  const parsePreview = () => {
    if (!questionText.trim()) return null;
    try {
      return parseQuestions(questionText);
    } catch (error) {
      return null;
    }
  };

  const preview = parsePreview();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Bulk Upload Questions
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={copyTemplate}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Template</span>
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Text Input Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Questions (Paste your questions below)
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUseRichEditor(!useRichEditor)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  useRichEditor
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>{useRichEditor ? "Rich Text" : "Plain Text"}</span>
              </button>
            </div>
          </div>

          {useRichEditor ? (
            <div className="border border-gray-300 rounded-lg">
              <RichTextEditor
                value={questionText}
                onChange={setQuestionText}
                placeholder="Paste your questions here with rich formatting, formulas, and tables..."
                height={400}
                disabled={isUploading}
              />
            </div>
          ) : (
            <textarea
              value={questionText}
              onChange={handleTextChange}
              placeholder="Paste your questions here in the format shown in the template..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
              disabled={isUploading}
            />
          )}
        </div>

        {/* Template Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Question Format
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <strong>Format:</strong> One question per block. First line = question text. Then options and answer.
            </p>
            <p>
              <strong>Options:</strong> A: [Option 1], B: [Option 2], C: [Option 3], D: [Option 4] (colon or period after letter)
            </p>
            <p>
              <strong>Answer:</strong> ANSWER: [Correct letter A–D]
            </p>
            <p>
              <strong>Points:</strong> Optional. POINTS: [Number] (default 1)
            </p>
            <p>
              <strong>Note:</strong> Separate each question with a blank line.
            </p>
          </div>
        </div>

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900 mb-2">
              Preview ({preview.length} questions detected)
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {preview.slice(0, 3).map((q, index) => (
                <div key={index} className="text-sm text-green-800">
                  <div className="font-medium">
                    <span>Q{index + 1}: </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(q.questionText || ""),
                      }}
                    />
                  </div>
                  <div className="ml-4 text-xs text-green-700">
                    Answer: {q.correctAnswer} | Points: {q.points || 1}
                  </div>
                </div>
              ))}
              {preview.length > 3 && (
                <div className="text-xs text-green-700">
                  ... and {preview.length - 3} more questions
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isUploading || !questionText.trim()}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isUploading ? "Processing..." : "Upload Questions"}</span>
          </button>
        </div>

        {/* Upload Results */}
        {showResults && uploadResults && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Upload Results
              </h4>
              <button
                onClick={resetUpload}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-green-600 font-semibold">
                    {uploadResults.successCount}
                  </div>
                  <div className="text-green-800">Success</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-yellow-600 font-semibold">
                    {uploadResults.skippedCount}
                  </div>
                  <div className="text-yellow-800">Skipped</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="text-red-600 font-semibold">
                    {uploadResults.errorCount}
                  </div>
                  <div className="text-red-800">Errors</div>
                </div>
              </div>

              {/* Success Messages */}
              {uploadResults.successMessages &&
                uploadResults.successMessages.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-800 mb-2">
                      Successfully Processed:
                    </h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {uploadResults.successMessages.map((message, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm text-green-700"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Error Messages */}
              {uploadResults.errorMessages &&
                uploadResults.errorMessages.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-red-800 mb-2">
                      Errors:
                    </h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {uploadResults.errorMessages.map((message, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm text-red-700"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
