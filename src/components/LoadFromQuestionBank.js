"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckSquare, Square, ChevronLeft } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { sanitizeHtml, stripHtmlToText } from "../lib/sanitize";

export default function LoadFromQuestionBank({ isOpen, onClose, interviewId, onLoadComplete }) {
  const [step, setStep] = useState("banks");
  const [banks, setBanks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [loadResult, setLoadResult] = useState(null);
  const { showSuccess, showError } = useMessages();

  useEffect(() => {
    if (!isOpen) return;
    setStep("banks");
    setSelectedBank(null);
    setQuestions([]);
    setSelectedIds(new Set());
    setLoadResult(null);
    fetch("/api/question-banks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.success && setBanks(d.questionBanks || []))
      .catch(() => setBanks([]));
  }, [isOpen]);

  const openBank = (bank) => {
    setSelectedBank(bank);
    setStep("questions");
    setSelectedIds(new Set());
    setQuestions([]);
    setIsLoading(true);
    fetch(`/api/question-banks/${bank.id}/questions`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setQuestions(d.questions || []);
      })
      .catch(() => setQuestions([]))
      .finally(() => setIsLoading(false));
  };

  const toggleAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(questions.map((q) => q.id)));
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmLoad = async () => {
    if (!interviewId || !selectedBank || selectedIds.size === 0) return;
    setIsLoading(true);
    setLoadResult(null);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/load-from-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionBankId: selectedBank.id, questionIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        setLoadResult(data);
        showSuccess(data.message || `${data.loaded} question(s) loaded.`);
        onLoadComplete?.();
      } else {
        showError(data.error || "Failed to load questions");
      }
    } catch (err) {
      showError("Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === "banks" && "Select question bank"}
            {step === "questions" && selectedBank && `Select questions from "${selectedBank.name}"`}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {step === "banks" && (
            <div className="space-y-2">
              {banks.length === 0 && !isLoading && <p className="text-gray-600">No question banks available.</p>}
              {banks.map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => openBank(bank)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{bank.name}</div>
                  <div className="text-sm text-gray-500">{bank.questionCount ?? 0} questions</div>
                </button>
              ))}
            </div>
          )}

          {step === "questions" && (
            <>
              {isLoading && questions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setStep("banks"); setSelectedBank(null); setQuestions([]); }}
                      className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    {questions.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        {selectedIds.size === questions.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {selectedIds.size === questions.length ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {questions.map((q) => (
                      <label
                        key={q.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {selectedIds.has(q.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleOne(q.id)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0 text-sm">
                          <span className="text-gray-700 line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml((q.questionText || "").slice(0, 120)) }} />
                          <span className="text-gray-500"> · {q.points ?? 1} pt</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {loadResult && (
                    <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                      <p><strong>{loadResult.loaded}</strong> question(s) loaded.</p>
                      {loadResult.alreadyInInterview?.length > 0 && (
                        <>
                          <p className="mt-2">The following were already in the interview and were not loaded again:</p>
                          <ul className="mt-1 list-disc list-inside">
                            {loadResult.alreadyInInterview.slice(0, 5).map((t, i) => (
                              <li key={i} className="truncate">{typeof t === "string" ? t : ""}</li>
                            ))}
                            {loadResult.alreadyInInterview.length > 5 && (
                              <li>… and {loadResult.alreadyInInterview.length - 5} more</li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          {step === "banks" && (
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          )}
          {step === "questions" && (
            <>
              <button type="button" onClick={() => { setStep("banks"); setSelectedBank(null); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmLoad}
                disabled={selectedIds.size === 0 || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Load {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
