"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Edit,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Type,
  CheckCircle,
} from "lucide-react";
import { useMessages } from "./MessageSystem";
import TypingQuestionForm from "./TypingQuestionForm";
import ConfirmationDialog from "./ConfirmationDialog";
import { sanitizeHtml } from "../lib/sanitize";

export default function TypingQuestionCards({ interviewId }) {
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchQuestion = useCallback(async () => {
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
        // For typing interviews, we expect only one question
        const typingQuestion = result.questions?.find(
          (q) => q.questionType === "TYPING"
        );
        setQuestion(typingQuestion || null);
        setError(null);
      } else {
        console.error("Failed to load typing question");
        setError("Failed to load typing question");
      }
    } catch (error) {
      console.error("Error fetching typing question:", error);
      setError("Failed to load typing question");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [interviewId]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

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
        setQuestion(null);
      } else {
        showError(result.error || "Failed to delete typing question");
      }
    } catch (err) {
      console.error("Error deleting typing question:", err);
      showError("Failed to delete typing question");
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
      setQuestion(question);
    } else {
      // Add new question
      setQuestion(question);
    }
    setEditingQuestion(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading typing question...</p>
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
            onClick={fetchQuestion}
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
            <h3 className="text-lg font-semibold text-gray-900">
              Typing Question
            </h3>
            <p className="text-sm text-gray-600">
              {question
                ? "1 typing question configured"
                : "No typing question yet"}
            </p>
          </div>
          {!question && (
            <button
              onClick={() => setShowQuestionForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Typing Question</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Display */}
      {question ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Type className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">
                    Typing Question
                  </span>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {question.points}pt{question.points !== 1 ? "s" : ""}
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  TYPING
                </span>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Question Text:
                </h4>
                <div
                  className="text-sm text-gray-900 bg-gray-50 rounded-lg p-4 border"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(question.questionText),
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium">
                    {question.questionType}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Points:</span>
                  <span className="ml-2 font-medium">{question.points}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleEdit(question)}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit typing question"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(question.id)}
                disabled={actionLoading === question.id}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Delete typing question"
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
      ) : (
        <div className="text-center py-12">
          <Type className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No typing question yet
          </h3>
          <p className="text-gray-600 mb-4">
            Add a typing question to configure this interview.
          </p>
          <button
            onClick={() => setShowQuestionForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Typing Question</span>
          </button>
        </div>
      )}

      {/* Typing Question Form Modal */}
      <TypingQuestionForm
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
        title="Delete typing question"
        message="Are you sure you want to delete this typing question? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={!!actionLoading}
      />
    </div>
  );
}
