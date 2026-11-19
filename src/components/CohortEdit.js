"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Calendar, Clock, Loader2, AlertCircle, Building2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import OrganisationSelect from "./OrganisationSelect";
import InstructionListEditor from "./InstructionListEditor";
import ResultsPublishOptions from "./ResultsPublishOptions";
import { cascadeResultsFlags } from "../lib/resultsPublish";
import {
  parseInstructionList,
  serializeInstructionList,
} from "../lib/cohortInstructions";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";

export default function CohortEdit({ cohortId }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organisation: "",
    openTime: "",
    closeTime: "",
    isPublished: true,
    resultsPublished: false,
    resultsShowAttempt: false,
    resultsShowCorrect: false,
  });
  const [instructionItems, setInstructionItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchCohort = useCallback(async () => {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      const response = await fetch(`/api/cohorts/${cohortId}`, { credentials: "include" });
      if (response.ok) {
        const result = await response.json();
        const cohort = result.cohort;
        setInstructionItems(
          parseInstructionList(cohort.instructions, { fallbackDefaults: true })
        );
        setFormData({
          name: cohort.name || "",
          description: cohort.description || "",
          organisation: cohort.organisation || "",
          openTime: cohort.openTime
            ? new Date(cohort.openTime).toISOString().slice(0, 16)
            : "",
          closeTime: cohort.closeTime
            ? new Date(cohort.closeTime).toISOString().slice(0, 16)
            : "",
          isPublished: cohort.isPublished !== false,
          resultsPublished: cohort.resultsPublished === true,
          resultsShowAttempt: cohort.resultsShowAttempt === true,
          resultsShowCorrect: cohort.resultsShowCorrect === true,
        });
      } else {
        showError("Failed to load cohort details");
      }
    } catch (error) {
      console.error("Error fetching cohort:", error);
      showError("Failed to load cohort details");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [cohortId]);

  useEffect(() => {
    fetchCohort();
  }, [fetchCohort]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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

    setIsSaving(true);

    try {
      const response = await fetch(`/api/cohorts/${cohortId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description,
          instructions: serializeInstructionList(instructionItems),
          organisation: formData.organisation?.trim() || null,
          openTime: formData.openTime,
          closeTime: formData.closeTime,
          isPublished: formData.isPublished,
          ...cascadeResultsFlags({
            showScore: formData.resultsPublished,
            showAttempt: formData.resultsShowAttempt,
            showCorrect: formData.resultsShowCorrect,
          }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || "Failed to update cohort");
        return;
      }

      showSuccess("Cohort updated successfully");
      router.push(`/admin/cohorts/${cohortId}`);
    } catch (error) {
      console.error("Error updating cohort:", error);
      showError("Failed to update cohort");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/cohorts/${cohortId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading cohort details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Cohort</h1>
          <p className="text-gray-600">
            Update the cohort information and settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Basic Information
            </h2>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Cohort Name *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                placeholder="Enter cohort name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="organisation"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                <Building2 className="w-4 h-4 inline mr-1" />
                Organisation
              </label>
              <OrganisationSelect
                id="organisation"
                value={formData.organisation}
                onChange={(e) => handleChange("organisation", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Description
              </label>
              <RichTextEditor
                value={formData.description}
                onChange={(value) => handleChange("description", value)}
                placeholder="Enter cohort description..."
                height={200}
              />
            </div>

            <div>
              <label
                htmlFor="instructions"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Instructions
              </label>
              <InstructionListEditor
                items={instructionItems}
                onChange={setInstructionItems}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={formData.isPublished}
                onChange={(e) => handleChange("isPublished", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">
                Published — when on, candidates can log in with their access key and attempt this cohort. When off, candidates see a message to contact examiner or administrator.
              </label>
            </div>

            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Publish results
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Checking a deeper option also turns on the ones above it.
              </p>
              <ResultsPublishOptions
                value={{
                  showScore: formData.resultsPublished,
                  showAttempt: formData.resultsShowAttempt,
                  showCorrect: formData.resultsShowCorrect,
                }}
                onChange={(next) =>
                  setFormData((prev) => ({
                    ...prev,
                    resultsPublished: next.showScore,
                    resultsShowAttempt: next.showAttempt,
                    resultsShowCorrect: next.showCorrect,
                  }))
                }
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Schedule
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="openTime"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Open Time *
                </label>
                <input
                  type="datetime-local"
                  id="openTime"
                  value={formData.openTime}
                  onChange={(e) => handleChange("openTime", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="closeTime"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  Close Time *
                </label>
                <input
                  type="datetime-local"
                  id="closeTime"
                  value={formData.closeTime}
                  onChange={(e) => handleChange("closeTime", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
                  required
                />
              </div>
            </div>

            {formData.openTime && formData.closeTime && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 text-blue-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Duration Preview:</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  This cohort will be active for{" "}
                  <strong>
                    {Math.ceil(
                      (new Date(formData.closeTime) -
                        new Date(formData.openTime)) /
                        (1000 * 60 * 60 * 24)
                    )}{" "}
                    days
                  </strong>{" "}
                  from {new Date(formData.openTime).toLocaleString()} to{" "}
                  {new Date(formData.closeTime).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
