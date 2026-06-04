"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Type,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useMessages } from "./MessageSystem";

export default function EditInterviewDialog({
  isOpen,
  onClose,
  interview,
  onInterviewUpdated,
}) {
  const [formData, setFormData] = useState({
    description: "",
    instructions: "",
    type: "APTITUDE",
    durationMinutes: 60,
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { showSuccess, showError } = useMessages();

  // Initialize form data when interview changes
  useEffect(() => {
    if (interview) {
      setFormData({
        description: interview.description || "",
        instructions: interview.instructions || "",
        type: interview.type || "APTITUDE",
        durationMinutes: interview.durationMinutes || 60,
        isActive: interview.isActive !== undefined ? interview.isActive : true,
      });
      setErrors({});
    }
  }, [interview]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.instructions.trim()) {
      newErrors.instructions = "Instructions are required";
    }

    if (!formData.type) {
      newErrors.type = "Interview type is required";
    }

    if (!formData.durationMinutes || formData.durationMinutes <= 0) {
      newErrors.durationMinutes = "Duration must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/interviews/${interview.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess(result.message || "Interview updated successfully");
        onInterviewUpdated?.(result.interview);
        onClose();
      } else {
        showError(result.error || "Failed to update interview");
      }
    } catch (error) {
      console.error("Error updating interview:", error);
      showError("Failed to update interview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !interview || !mounted) return null;

  const dialog = (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Interview
              </h2>
              <p className="text-sm text-gray-600">
                Update interview details and settings
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 ${
                errors.description ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="Enter interview description..."
              disabled={isLoading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructions *
            </label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 ${
                errors.instructions ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="Enter interview instructions for candidates..."
              disabled={isLoading}
            />
            {errors.instructions && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.instructions}
              </p>
            )}
          </div>

          {/* Type and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interview Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interview Type *
              </label>
              <div className="relative">
                <Type className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white ${
                    errors.type ? "border-red-300" : "border-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  <option value="APTITUDE">Aptitude Test</option>
                  <option value="TYPING">Typing Test</option>
                  <option value="ORAL">Oral Interview</option>
                </select>
              </div>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.type}
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  name="durationMinutes"
                  value={formData.durationMinutes}
                  onChange={handleInputChange}
                  min="1"
                  max="480"
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500 ${
                    errors.durationMinutes
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="60"
                  disabled={isLoading}
                />
              </div>
              {errors.durationMinutes && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.durationMinutes}
                </p>
              )}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Interview Status
              </h3>
              <p className="text-sm text-gray-600">
                {formData.isActive
                  ? "Interview is active and available to candidates"
                  : "Interview is inactive and hidden from candidates"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))
              }
              disabled={isLoading}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {formData.isActive ? (
                <ToggleRight className="w-6 h-6 text-green-600" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
              <span>{formData.isActive ? "Active" : "Inactive"}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isLoading ? "Updating..." : "Update Interview"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}
