"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Calendar, Clock, Loader2, AlertCircle, Building2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import OrganisationSelect from "./OrganisationSelect";
import InstructionListEditor from "./InstructionListEditor";
import { DEFAULT_COHORT_INSTRUCTIONS, serializeInstructionList } from "../lib/cohortInstructions";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";

export default function CohortCreate() {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    organisation: "",
    openTime: "",
    closeTime: "",
  });
  const [instructionItems, setInstructionItems] = useState([
    ...DEFAULT_COHORT_INSTRUCTIONS,
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { showSuccess, showError } = useMessages();

  const isAdmin = currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN";

  useEffect(() => {
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setCurrentUser(d.user);
          if (d.user.role === "EXAMINER" && d.user.organisation) {
            setFormData((prev) => ({ ...prev, organisation: d.user.organisation || "" }));
          }
        }
      })
      .catch(() => {});
  }, []);

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
    if (isAdmin && !formData.organisation?.trim()) {
      showError("Organisation is required");
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
      const response = await fetch("/api/cohorts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description,
          instructions: serializeInstructionList(instructionItems),
          organisation: isAdmin ? formData.organisation.trim() : undefined,
          openTime: formData.openTime,
          closeTime: formData.closeTime,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || "Failed to create cohort");
        return;
      }

      showSuccess("Cohort created successfully");
      router.push(`/admin/cohorts/${result.cohort.id}`);
    } catch (error) {
      console.error("Error creating cohort:", error);
      showError("Failed to create cohort");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/cohorts");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create New Cohort
          </h1>
          <p className="text-gray-600">
            Set up a new cohort for your interview sessions. All fields marked
            with * are required.
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

            {isAdmin && (
              <div>
                <label
                  htmlFor="organisation"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Organisation *
                </label>
                <OrganisationSelect
                  id="organisation"
                  value={formData.organisation}
                  onChange={(e) => handleChange("organisation", e.target.value)}
                  required={isAdmin}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white"
                />
              </div>
            )}
            {!isAdmin && currentUser?.organisation && (
              <p className="text-sm text-gray-600">
                Organisation: <strong>{currentUser.organisation}</strong> (from your profile)
              </p>
            )}
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
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Cohort
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
