"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save, Loader2, Type } from "lucide-react";
import { useMessages } from "./MessageSystem";
import RichTextEditor from "./RichTextEditor";

export default function TypingQuestionForm({
  isOpen,
  onClose,
  interviewId,
  onQuestionSuccess,
  question = null,
  isEditing = false,
}) {
  const [formData, setFormData] = useState({
    questionText: question?.questionText || "",
    questionType: "TYPING", // Fixed for typing interviews
    points: question?.points || 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useMessages();

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.questionText.trim()) {
      showError("Question text is required");
      return;
    }

    if (formData.points < 1) {
      showError("Points must be at least 1");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing
        ? `/api/interviews/${interviewId}/questions/${question.id}`
        : `/api/interviews/${interviewId}/questions`;

      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          questionText: formData.questionText,
          questionType: formData.questionType,
          points: parseInt(formData.points),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess(
          isEditing
            ? "Typing question updated successfully"
            : "Typing question created successfully"
        );
        onQuestionSuccess(result.question);
        onClose();
      } else {
        showError(result.error || "Failed to save typing question");
      }
    } catch (error) {
      console.error("Error saving typing question:", error);
      showError("Failed to save typing question");
    } finally {
      setIsLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const formModal = (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Type className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? "Edit Typing Question" : "Add Typing Question"}
              </h2>
              <p className="text-sm text-gray-600">
                {isEditing
                  ? "Update the typing question details"
                  : "Create a new typing question for this interview"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question Type (Fixed) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Type
            </label>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Type className="w-5 h-5 text-gray-500" />
              <span className="text-gray-700 font-medium">Typing</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                Fixed for typing interviews
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Typing interviews can only have one question of type
              &quot;Typing&quot;
            </p>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Text *
            </label>
            <RichTextEditor
              value={formData.questionText}
              onChange={(value) => handleInputChange("questionText", value)}
              placeholder="Enter the typing question or instruction text..."
              height={200}
            />
            <p className="text-xs text-gray-500 mt-1">
              This text will be displayed to candidates during the typing test
            </p>
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points *
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.points}
              onChange={(e) => handleInputChange("points", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
              placeholder="Enter points for this question"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Points awarded for completing the typing test (1-100)
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Type className="w-5 h-5 text-blue-600 mt-0.5" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900">
                  Typing Interview Information
                </h4>
                <div className="mt-2 text-sm text-blue-800">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Only one typing question is allowed per interview</li>
                    <li>Candidates will type the provided text</li>
                    <li>
                      System will track typing speed, accuracy, and words per
                      minute
                    </li>
                    <li>
                      Results will show detailed typing performance metrics
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {isLoading
                  ? "Saving..."
                  : isEditing
                  ? "Update Question"
                  : "Create Question"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(formModal, document.body);
}
