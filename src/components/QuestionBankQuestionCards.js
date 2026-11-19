"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Edit, Trash2, Plus, Loader2, AlertCircle, FileText } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { htmlToPlainText } from "../lib/sanitize";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager } from "./ClientTableChrome";
import QuestionBankQuestionForm from "./QuestionBankQuestionForm";
import ConfirmationDialog from "./ConfirmationDialog";

export default function QuestionBankQuestionCards({ questionBankId }) {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
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

  const table = useClientTable(questions, {
    pageSize: 10,
    searchText: (q) => htmlToPlainText(q.questionText || ""),
  });
  const filtered = table.pageRows;

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
          <TableSearch
            query={table.query}
            setQuery={table.setQuery}
            placeholder="Search questions..."
            filteredCount={table.filteredCount}
            totalCount={table.totalCount}
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
      ) : table.filteredCount === 0 ? (
        <p className="text-gray-600 py-8">No questions match your search.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 w-12">#</th>
                  <th className="px-4 py-2">Question</th>
                  <th className="px-4 py-2">Pts</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((q, index) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">
                      {(table.page - 1) * table.pageSize + index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-gray-900 line-clamp-2">
                        {htmlToPlainText(q.questionText || "")}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{q.points ?? 1}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditingQuestion(q); setShowForm(true); }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(q.id)}
                        disabled={actionLoading === q.id}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete"
                      >
                        {actionLoading === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <TablePager
        page={table.page}
        setPage={table.setPage}
        totalPages={table.totalPages}
        filteredCount={table.filteredCount}
        pageSize={table.pageSize}
      />

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
