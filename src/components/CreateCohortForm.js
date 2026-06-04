"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import {
  useMessages,
  SuccessMessages,
  ErrorMessages,
  ValidationMessages,
} from "./MessageSystem";

export default function CreateCohortForm() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
    openTime: "",
    closeTime: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useMessages();
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      showError("Cohort name is required");
      return false;
    }
    if (!formData.openTime) {
      showError("Open time is required");
      return false;
    }
    if (!formData.closeTime) {
      showError("Close time is required");
      return false;
    }
    if (new Date(formData.openTime) >= new Date(formData.closeTime)) {
      showError("Close time must be after open time");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/cohorts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || ErrorMessages.SYSTEM_ERROR);
        return;
      }

      showSuccess(SuccessMessages.COHORT_CREATED);
      router.push("/admin/cohorts");
    } catch (error) {
      console.error("Cohort creation error:", error);
      showError(ErrorMessages.NETWORK_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Cohort Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                  placeholder="Enter cohort name"
                  disabled={isLoading}
                />
                <Users className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                placeholder="Enter cohort description"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Instructions
          </h2>

          <div>
            <label
              htmlFor="instructions"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Instructions for Candidates
            </label>
            <div className="relative">
              <textarea
                id="instructions"
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                placeholder="Enter instructions for candidates"
                disabled={isLoading}
              />
              <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-4" />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Provide clear instructions for candidates about the cohort
              process.
            </p>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Schedule</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="openTime"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Open Time *
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  id="openTime"
                  name="openTime"
                  value={formData.openTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                  disabled={isLoading}
                />
                <Calendar className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label
                htmlFor="closeTime"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Close Time *
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  id="closeTime"
                  name="closeTime"
                  value={formData.closeTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                  disabled={isLoading}
                />
                <Clock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              isLoading ||
              !formData.name ||
              !formData.openTime ||
              !formData.closeTime
            }
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Create Cohort</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
