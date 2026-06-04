"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  Clock,
  Type,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
} from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";
import RichTextEditor from "./RichTextEditor";

export default function InterviewDialog({
  isOpen,
  onClose,
  cohortId,
  onInterviewSuccess,
}) {
  const [formData, setFormData] = useState({
    type: "APTITUDE",
    durationMinutes: 60,
    instructions: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useMessages();

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.type) {
      showError("Interview type is required");
      return false;
    }
    if (!formData.durationMinutes || formData.durationMinutes < 1) {
      showError("Duration must be at least 1 minute");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/cohorts/${cohortId}/interviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          type: formData.type,
          durationMinutes: parseInt(formData.durationMinutes),
          instructions: formData.instructions.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || "Failed to add interview");
        return;
      }

      showSuccess("Interview added successfully");
      onInterviewSuccess(result.interview);
      handleClose();
    } catch (error) {
      console.error("Error adding interview:", error);
      showError("Failed to add interview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      type: "APTITUDE",
      durationMinutes: 60,
      instructions: "",
    });
    onClose();
  };

  const interviewTypes = [
    { value: "APTITUDE", label: "Aptitude", enabled: true },
    { value: "TYPING", label: "Typing", enabled: true },
    { value: "ORAL", label: "Oral", enabled: false },
  ];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const dialog = (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Add Interview to Cohort
              </h2>
              <p className="text-sm text-gray-600">
                Create a new interview for this cohort
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Interview Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Interview Type *
            </label>
            <div className="grid grid-cols-1 gap-3">
              {interviewTypes.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                    formData.type === type.value
                      ? "border-blue-500 bg-blue-50"
                      : type.enabled
                      ? "border-gray-300 hover:border-gray-400"
                      : "border-gray-200 bg-gray-50 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.value}
                    checked={formData.type === type.value}
                    onChange={(e) => handleChange("type", e.target.value)}
                    disabled={!type.enabled || isLoading}
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.type === type.value
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {formData.type === type.value && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Type className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">
                          {type.label}
                        </span>
                        {!type.enabled && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      {type.value === "APTITUDE" && (
                        <p className="text-sm text-gray-600 mt-1">
                          Multiple choice questions to assess cognitive
                          abilities
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (Minutes) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="300"
                value={formData.durationMinutes}
                onChange={(e) =>
                  handleChange("durationMinutes", e.target.value)
                }
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                placeholder="Enter duration in minutes"
                disabled={isLoading}
              />
              <Clock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Recommended: 30-120 minutes
            </p>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Instructions (Optional)
            </label>
            <div className="border border-gray-300 rounded-xl overflow-hidden">
              <RichTextEditor
                value={formData.instructions}
                onChange={(value) => handleChange("instructions", value)}
                placeholder="Enter interview instructions for candidates..."
                disabled={isLoading}
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Provide specific instructions for candidates taking this interview
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding Interview...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Interview</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}
