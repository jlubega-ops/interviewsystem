"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  User,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle,
  UserPlus,
} from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";

export default function EnrollmentDialog({
  isOpen,
  onClose,
  cohortId,
  onEnrollmentSuccess,
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [existingUser, setExistingUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const { showSuccess, showError } = useMessages();

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear existing user details when form changes
    if (existingUser) {
      setExistingUser(null);
      setShowUserDetails(false);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      showError("Candidate name is required");
      return false;
    }
    if (!formData.email.trim()) {
      showError("Email address is required");
      return false;
    }
    if (!formData.phone.trim()) {
      showError("Phone number is required");
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError("Please enter a valid email address");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/cohorts/${cohortId}/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === "CANDIDATE_EXISTS_DIFFERENT_NAME") {
          setExistingUser(result.existingCandidate);
          setShowUserDetails(true);
          showError(
            "A candidate with this email already exists but with a different name"
          );
          return;
        }
        showError(result.error || "Failed to enroll candidate");
        return;
      }

      showSuccess("Candidate enrolled successfully");
      onEnrollmentSuccess(result.candidate);
      handleClose();
    } catch (error) {
      console.error("Error enrolling candidate:", error);
      showError("Failed to enroll candidate");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", email: "", phone: "" });
    setExistingUser(null);
    setShowUserDetails(false);
    onClose();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const dialog = (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Enroll Candidate
              </h2>
              <p className="text-sm text-gray-600">
                Add a new candidate to this cohort
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
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              <User className="w-4 h-4 inline mr-1" />
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
              placeholder="Enter candidate's full name"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
              placeholder="Enter candidate's email"
              required
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
              placeholder="Enter candidate's phone number"
              required
            />
          </div>

          {/* Existing User Details */}
          {showUserDetails && existingUser && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                    User Already Exists
                  </h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    A user with this email already exists but with different
                    details:
                  </p>
                  <div className="bg-white rounded-lg p-3 border border-yellow-200">
                    <div className="space-y-1 text-sm">
                      <div>
                        <strong>Name:</strong> {existingUser.name}
                      </div>
                      <div>
                        <strong>Email:</strong> {existingUser.email}
                      </div>
                      <div>
                        <strong>Phone:</strong> {existingUser.phone}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    Please verify the email address or contact the
                    administrator.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enrolling...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Enroll Candidate</span>
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
