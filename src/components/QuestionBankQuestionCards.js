"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Edit, Trash2, Plus, Loader2, AlertCircle, FileText } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { sanitizeHtml, stripHtmlToText } from "../lib/sanitize";
import QuestionBankQuestionForm from "./QuestionBankQuestionForm";
import ConfirmationDialog from "./ConfirmationDialog";

export default function QuestionBankQuestionCards({ questionBankId }) {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fetchingRef = useRef(false);
  const { showSuccess, showError } = useMessages();

  const fetchQuestions = useCallback(async () => {
    if (!questionBankId || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/question-banks/${questionBankId}/questions`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setQuestions(data.questions || []);
      else showError(data.error || "Failed to load questions");
    } catch (err) {
      showError("Failed to load questions");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [questionBankId]);

  useEffect(() => {
    fetchQuestions();
  }, [questionBankId, fetchQuestions]);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      const res = await fetch(`/api/question-banks/${questionBankId}/questions/${deleteId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message);
        setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
        setDeleteId(null);
      } else {
        showError(data.error || "Failed to delete");
      }
    } catch (err) {
      showError("Failed to delete question");
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuestionSuccess = (question) => {
    if (editingQuestion) {
      setQuestions((prev) => prev.map((q) => (q.id === question.id ? question : q)));
    } else {
      setQuestions((prev) => [...prev, question]);
    }
    setEditingQuestion(null);
  };

  const filtered = questions.filter((q) =>
    stripHtmlToText(q.questionText || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading questions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>
        <button
          onClick={() => { setEditingQuestion(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>
      <p className="text-sm text-gray-600">
        {filtered.length} of {questions.length} question{questions.length !== 1 ? "s" : ""}
      </p>
      {questions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No questions in this bank yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add First Question
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-600 py-8">No questions match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((q, index) => {
            const opts = Array.isArray(q.options) ? q.options : [];
            const correctLetter = (q.correctAnswer || "").toString().trim().toUpperCase();
            return (
              <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">Q{index + 1}</span>
                      <span className="text-xs text-gray-500">{q.points ?? 1} pt</span>
                    </div>
                    <div className="text-sm text-gray-700 line-clamp-2 mb-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.questionText || "") }} />
                    {opts.length > 0 && (
                      <ul className="space-y-0.5 mt-1">
                        {opts.map((opt) => (
                          <li
                            key={opt?.letter}
                            className={`text-xs py-0.5 px-1.5 rounded flex gap-1.5 ${correctLetter && String(opt?.letter).toUpperCase() === correctLetter ? "bg-green-50 text-green-800 font-medium" : "text-gray-600"}`}
                          >
                            <span>{opt?.letter ?? "—"}</span>
                            <span className="line-clamp-1">{typeof opt?.text === "string" ? stripHtmlToText(opt.text) : ""}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingQuestion(q); setShowForm(true); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(q.id)}
                      disabled={actionLoading === q.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {actionLoading === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <QuestionBankQuestionForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingQuestion(null); }}
        questionBankId={questionBankId}
        onQuestionSuccess={handleQuestionSuccess}
        question={editingQuestion}
        isEditing={!!editingQuestion}
      />

      <ConfirmationDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete question"
        message="Remove this question from the bank? This cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={!!actionLoading}
      />
    </div>
  );
}
