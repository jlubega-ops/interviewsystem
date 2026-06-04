"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Edit,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Search,
  Filter,
} from "lucide-react";
import { useMessages } from "./MessageSystem";
import QuestionForm from "./QuestionForm";
import ConfirmationDialog from "./ConfirmationDialog";
import { sanitizeHtml, stripHtmlToText } from "../lib/sanitize";

export default function QuestionCards({ interviewId }) {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  // Filter questions based on search and type
  const filteredQuestions = questions.filter((question) => {
    const matchesSearch = stripHtmlToText(question.questionText || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === "ALL" || question.questionType === filterType;
    return matchesSearch && matchesType;
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
            <p className="text-sm text-gray-600">
              {filteredQuestions.length} of {questions.length} question
              {questions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowQuestionForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="TRUE_FALSE">True/False</option>
              <option value="TEXT">Text</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No questions yet
          </h3>
          <p className="text-gray-600 mb-4">
            Add questions to this interview to get started.
          </p>
          <button
            onClick={() => setShowQuestionForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Question</span>
          </button>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-8">
          <Search className="w-8 h-8 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No questions found
          </h3>
          <p className="text-gray-600">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredQuestions.map((question, index) => {
            const options = Array.isArray(question.options) ? question.options : [];
            const correctLetter = question.correctAnswer ? String(question.correctAnswer).trim().toUpperCase() : "";
            return (
              <div
                key={question.id}
                className="bg-white rounded-lg border border-gray-200 p-2 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mb-1">
                      <span className="text-xs font-semibold text-gray-700">
                        Q{index + 1}
                      </span>
                      {getQuestionTypeBadge(question.questionType)}
                      <span className="text-xs text-gray-500">
                        {question.points} pt{question.points !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div
                      className="text-xs text-gray-700 line-clamp-2 mb-1.5"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(question.questionText),
                      }}
                    />
                    {/* Options list: correct option highlighted */}
                    {options.length > 0 && (
                      <ul className="space-y-0.5 mt-1">
                        {options.map((opt) => {
                          const isCorrect = correctLetter && String(opt?.letter || "").trim().toUpperCase() === correctLetter;
                          return (
                            <li
                              key={opt?.letter || opt?.text}
                              className={`text-xs py-0.5 px-1.5 rounded flex items-baseline gap-1.5 ${
                                isCorrect
                                  ? "bg-green-50 border-l-2 border-green-500 text-green-800 font-medium"
                                  : "text-gray-600 border-l-2 border-transparent"
                              }`}
                            >
                              <span className="flex-shrink-0 font-medium">{opt?.letter ?? "—"}</span>
                              <span className="min-w-0 line-clamp-1">
                                {typeof opt?.text === "string" ? stripHtmlToText(opt.text) : ""}
                              </span>
                              {isCorrect && (
                                <span className="flex-shrink-0 text-green-600 text-[10px]">✓ correct</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(question)}
                      className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      title="Edit question"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(question.id)}
                      disabled={actionLoading === question.id}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete question"
                    >
                      {actionLoading === question.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
