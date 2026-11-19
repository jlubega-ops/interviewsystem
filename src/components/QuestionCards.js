"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Edit,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  Filter,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { useMessages } from "./MessageSystem";
import QuestionForm from "./QuestionForm";
import ConfirmationDialog from "./ConfirmationDialog";
import { htmlToPlainText } from "../lib/sanitize";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager } from "./ClientTableChrome";
import QuestionOptionsPanel from "./QuestionOptionsPanel";
import { useExpandableIds } from "../hooks/useExpandableIds";
import { resolveCorrectLetter } from "../lib/questionOptions";

export default function QuestionCards({ interviewId }) {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchQuestions = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/interviews/${interviewId}/questions`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setQuestions(result.questions || []);
        setError(null);
      } else {
        console.error("Failed to load questions");
        setError("Failed to load questions");
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
      setError("Failed to load questions");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [interviewId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDeleteClick = (questionId) => {
    setDeleteConfirmQuestionId(questionId);
  };

  const handleDeleteConfirm = async () => {
    const questionId = deleteConfirmQuestionId;
    if (!questionId) return;
    setDeleteConfirmQuestionId(null);
    setActionLoading(questionId);

    try {
      const response = await fetch(
        `/api/interviews/${interviewId}/questions/${questionId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showSuccess(result.message);
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      } else {
        showError(result.error || "Failed to delete question");
      }
    } catch (err) {
      console.error("Error deleting question:", err);
      showError("Failed to delete question");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmQuestionId(null);
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setShowQuestionForm(true);
  };

  const handleQuestionSuccess = (question) => {
    if (editingQuestion) {
      // Update existing question
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? question : q))
      );
    } else {
      // Add new question
      setQuestions((prev) => [...prev, question]);
    }
    setEditingQuestion(null);
  };

  const getQuestionTypeBadge = (type) => {
    const colors = {
      MULTIPLE_CHOICE: "bg-blue-100 text-blue-800",
      TRUE_FALSE: "bg-green-100 text-green-800",
      TEXT: "bg-purple-100 text-purple-800",
    };
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
          colors[type] || "bg-gray-100 text-gray-800"
        }`}
      >
        {type.replace("_", " ")}
      </span>
    );
  };

  const typedQuestions = useMemo(
    () =>
      filterType === "ALL"
        ? questions
        : questions.filter((question) => question.questionType === filterType),
    [questions, filterType]
  );
  const table = useClientTable(typedQuestions, {
    pageSize: 10,
    searchText: (question) => htmlToPlainText(question.questionText || ""),
  });
  const optionExpand = useExpandableIds(table.filtered.map((q) => q.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchQuestions}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <TableSearch
          query={table.query}
          setQuery={table.setQuery}
          placeholder="Search questions..."
          filteredCount={table.filteredCount}
          totalCount={typedQuestions.length}
        />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="ALL">All types</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True/False</option>
            <option value="TEXT">Text</option>
          </select>
          {table.filteredCount > 0 ? (
            <button
              type="button"
              onClick={optionExpand.toggleAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              {optionExpand.allExpanded ? (
                <ChevronsDownUp className="w-4 h-4" />
              ) : (
                <ChevronsUpDown className="w-4 h-4" />
              )}
              {optionExpand.allExpanded ? "Collapse options" : "Expand options"}
            </button>
          ) : null}
          <button
            onClick={() => setShowQuestionForm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add question
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No questions yet
          </h3>
          <p className="text-gray-600 mb-4">
            Add questions to this interview to get started.
          </p>
          <button
            onClick={() => setShowQuestionForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add first question
          </button>
        </div>
      ) : table.filteredCount === 0 ? (
        <p className="p-6 text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
          No questions match your search.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 w-12">#</th>
                  <th className="px-4 py-2">Question</th>
                  <th className="px-4 py-2 hidden md:table-cell">Type</th>
                  <th className="px-4 py-2">Pts</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.pageRows.map((question, index) => (
                  <tr key={question.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2 text-gray-500">
                      {(table.page - 1) * table.pageSize + index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-gray-900">
                        {htmlToPlainText(question.questionText)}
                      </p>
                      <QuestionOptionsPanel
                        options={question.options}
                        correctAnswer={resolveCorrectLetter(question)}
                        showCorrect
                        expanded={optionExpand.isExpanded(question.id)}
                        onToggle={() => optionExpand.toggle(question.id)}
                      />
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      {getQuestionTypeBadge(question.questionType)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{question.points}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(question)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit question"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(question.id)}
                        disabled={actionLoading === question.id}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete question"
                      >
                        {actionLoading === question.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={table.page}
            setPage={table.setPage}
            totalPages={table.totalPages}
            filteredCount={table.filteredCount}
            pageSize={table.pageSize}
          />
        </div>
      )}

      {/* Question Form Modal */}
      <QuestionForm
        isOpen={showQuestionForm}
        onClose={() => {
          setShowQuestionForm(false);
          setEditingQuestion(null);
        }}
        interviewId={interviewId}
        onQuestionSuccess={handleQuestionSuccess}
        question={editingQuestion}
        isEditing={!!editingQuestion}
      />

      <ConfirmationDialog
        isOpen={!!deleteConfirmQuestionId}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete question"
        message="Are you sure you want to delete this question? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={!!actionLoading}
      />
    </div>
  );
}
