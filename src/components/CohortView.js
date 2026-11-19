"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Edit,
  Trash2,
  Plus,
  UserCheck,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  UserPlus,
  Ban,
} from "lucide-react";
import { useMessages, ErrorMessages } from "./MessageSystem";
import RichTextDisplay from "./RichTextDisplay";
import InstructionListDisplay from "./InstructionListDisplay";
import EnrollmentDialog from "./EnrollmentDialog";
import EnrolledCandidates from "./EnrolledCandidates";
import CohortInterviews from "./CohortInterviews";
import BulkCandidateUpload from "./BulkCandidateUpload";
import DeleteCohortModal from "./DeleteCohortModal";
import AssignExaminerModal from "./AssignExaminerModal";
import PublishResultsModal from "./PublishResultsModal";
import { cascadeResultsFlags } from "../lib/resultsPublish";
import { useServerTime } from "../hooks/useServerTime";

export default function CohortView({ cohortId }) {
  const { serverNow } = useServerTime();
  const [cohort, setCohort] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignExaminer, setShowAssignExaminer] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { showError, showSuccess } = useMessages();
  const [publishToggling, setPublishToggling] = useState(false);
  const [resultsToggling, setResultsToggling] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

  useEffect(() => {
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.user && setCurrentUser(d.user))
      .catch(() => {});
  }, []);

  const handleTogglePublish = useCallback(async () => {
    if (!cohort || publishToggling) return;
    const nextPublished = !(cohort.isPublished !== false);
    setPublishToggling(true);
    try {
      const response = await fetch(`/api/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setCohort((prev) => (prev ? { ...prev, isPublished: nextPublished } : null));
        showSuccess(data.message || (nextPublished ? "Cohort is now published. Candidates can access it." : "Cohort is now unpublished. Candidates cannot access it."));
      } else {
        showError(data.error || "Failed to update publish status");
      }
    } catch (e) {
      showError(e?.message || "Failed to update publish status");
    } finally {
      setPublishToggling(false);
    }
  }, [cohort, cohortId, publishToggling, showError, showSuccess]);

  const handleSaveResultsPublish = useCallback(async (options) => {
    if (!cohort || resultsToggling) return;
    const flags = cascadeResultsFlags(options);
    setResultsToggling(true);
    try {
      const response = await fetch(`/api/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resultsPublished: flags.resultsPublished,
          resultsShowAttempt: flags.resultsShowAttempt,
          resultsShowCorrect: flags.resultsShowCorrect,
          showScore: flags.resultsPublished,
          showAttempt: flags.resultsShowAttempt,
          showCorrect: flags.resultsShowCorrect,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setCohort((prev) =>
          prev
            ? {
                ...prev,
                resultsPublished: flags.resultsPublished,
                resultsShowAttempt: flags.resultsShowAttempt,
                resultsShowCorrect: flags.resultsShowCorrect,
              }
            : null
        );
        setShowResultsModal(false);
        showSuccess(
          data.message ||
            (flags.resultsPublished
              ? "Results visibility updated."
              : "Results are now hidden from candidates.")
        );
      } else {
        showError(data.error || "Failed to update results visibility");
      }
    } catch (e) {
      showError(e?.message || "Failed to update results visibility");
    } finally {
      setResultsToggling(false);
    }
  }, [cohort, cohortId, resultsToggling, showError, showSuccess]);

  const fetchCohort = useCallback(async () => {
    try {
      const response = await fetch(`/api/cohorts/${cohortId}`, { credentials: "include" });
      if (response.ok) {
        const result = await response.json();
        setCohort(result.cohort);
      } else {
        showError("Failed to load cohort details");
      }
    } catch (error) {
      console.error("Error fetching cohort:", error);
      showError("Failed to load cohort details");
    } finally {
      setIsLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchCohort();
  }, [fetchCohort]);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteSuccess = () => {
    window.location.href = "/admin/cohorts";
  };

  const handleEnrollmentSuccess = (candidate) => {
    // Trigger refetch of enrolled candidates
    setEnrollmentSuccess(Date.now());
    // Refresh cohort data to update enrollment count
    fetchCohort();
    setShowEnrollmentDialog(false);
  };

  const handleBulkUploadComplete = () => {
    setShowBulkUpload(false);
    setEnrollmentSuccess(Date.now());
    fetchCohort();
  };

  const handleExaminerAssigned = () => {
    fetchCohort();
  };

  const handleUnassignExaminer = async (userId) => {
    if (!confirm("Unassign this examiner from the cohort?")) return;
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/examiners/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) fetchCohort();
      else {
        const data = await res.json();
        showError(data.error || "Failed to unassign");
      }
    } catch {
      showError("Failed to unassign examiner");
    }
  };

  const getStatusBadge = (cohort) => {
    if (!serverNow) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <Clock className="w-3 h-3 mr-1" />
          —
        </span>
      );
    }
    const openTime = new Date(cohort.openTime);
    const closeTime = new Date(cohort.closeTime);

    if (serverNow < openTime) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          Not Started
        </span>
      );
    } else if (serverNow >= openTime && serverNow <= closeTime) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Closed
        </span>
      );
    }
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

  if (!cohort) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Cohort Not Found
        </h3>
        <p className="text-gray-600 mb-4">
          The requested cohort could not be found.
        </p>
        <Link
          href="/admin/cohorts"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Cohorts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {cohort.name}
            </h1>
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              {getStatusBadge(cohort)}
              <div className="inline-flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Published</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cohort.isPublished !== false}
                  disabled={publishToggling}
                  onClick={handleTogglePublish}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    cohort.isPublished !== false ? "bg-emerald-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                      cohort.isPublished !== false ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                {publishToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                  <span className="text-xs text-gray-500">
                    {cohort.isPublished !== false ? "On" : "Off"}
                  </span>
                )}
              </div>
              <div className="inline-flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Publish results</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cohort.resultsPublished === true}
                  disabled={resultsToggling}
                  onClick={() => setShowResultsModal(true)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    cohort.resultsPublished === true ? "bg-emerald-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                      cohort.resultsPublished === true ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                {resultsToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                  <span className="text-xs text-gray-500">
                    {cohort.resultsPublished === true
                      ? cohort.resultsShowCorrect
                        ? "On · score, attempt, answers"
                        : cohort.resultsShowAttempt
                          ? "On · score and attempt"
                          : "On · score only"
                      : "Off"}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-600">
                Created by {cohort.creator?.fullName || "Unknown"}
              </span>
              {cohort.organisation && (
                <span className="text-sm text-gray-500">
                  · {cohort.organisation}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
              <button
                onClick={() => setShowAssignExaminer(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign examiner
              </button>
            )}
            <Link
              href={`/admin/cohorts/${cohortId}/edit`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
            <button
              onClick={handleDeleteClick}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        {cohort.description && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Description
            </h3>
            <RichTextDisplay html={cohort.description} className="text-gray-600 text-sm" />
          </div>
        )}

        {cohort.instructions ? (
          <div className="mb-4">
            <InstructionListDisplay html={cohort.instructions} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Open Time</p>
              <p className="text-sm text-gray-600">
                {new Date(cohort.openTime).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Close Time</p>
              <p className="text-sm text-gray-600">
                {new Date(cohort.closeTime).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Enrollments</p>
              <p className="text-sm text-gray-600">
                {cohort.enrollmentCount || 0} candidates
              </p>
            </div>
          </div>
        </div>

        {cohort.examiners && cohort.examiners.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Assigned examiners</h3>
            <ul className="space-y-2">
              {cohort.examiners.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">
                      {a.user?.fullName || [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") || a.user?.email || "Unknown"}
                    </span>
                    <span className="text-sm text-gray-500">{a.user?.email}</span>
                    {a.assigner && (
                      <span className="text-xs text-gray-400 ml-1">(assigned by {a.assigner.fullName})</span>
                    )}
                    {a.user?.isSuspended && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        <Ban className="w-3 h-3" />
                        Suspended
                      </span>
                    )}
                  </div>
                  {(currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") && (
                    <button
                      type="button"
                      onClick={() => handleUnassignExaminer(a.userId)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Unassign
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "overview", label: "Overview", icon: FileText },
              { id: "candidates", label: "Candidates", icon: Users },
              { id: "interviews", label: "Interviews", icon: UserCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Quick Stats
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Enrollments:</span>
                      <span className="font-medium">
                        {cohort.enrollmentCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Interviews:</span>
                      <span className="font-medium">
                        {cohort.interviewCount || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge(cohort)}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Time Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-600 text-sm">Duration:</span>
                      <p className="font-medium">
                        {Math.ceil(
                          (new Date(cohort.closeTime) -
                            new Date(cohort.openTime)) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm">
                        Time Remaining:
                      </span>
                      <p className="font-medium">
                        {serverNow && serverNow < new Date(cohort.closeTime)
                          ? `${Math.ceil(
                              (new Date(cohort.closeTime) - serverNow) /
                                (1000 * 60 * 60)
                            )} hours`
                          : serverNow ? "Expired" : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "candidates" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  {showBulkUpload && (
                    <button
                      onClick={() => setShowBulkUpload(false)}
                      className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Back to Candidates
                    </button>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">
                    {showBulkUpload
                      ? "Bulk Upload Candidates"
                      : "Enrolled Candidates"}
                  </h3>
                </div>
                {!showBulkUpload && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowEnrollmentDialog(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Enroll Candidate
                    </button>
                    <button
                      onClick={() => setShowBulkUpload(true)}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </button>
                  </div>
                )}
              </div>
              {showBulkUpload ? (
                <BulkCandidateUpload
                  cohortId={cohortId}
                  onUploadComplete={handleBulkUploadComplete}
                />
              ) : (
                <EnrolledCandidates
                  cohortId={cohortId}
                  onEnrollmentSuccess={enrollmentSuccess}
                />
              )}
            </div>
          )}

          {activeTab === "interviews" && (
            <CohortInterviews cohortId={cohortId} />
          )}
        </div>
      </div>

      {/* Enrollment Dialog */}
      <EnrollmentDialog
        isOpen={showEnrollmentDialog}
        onClose={() => setShowEnrollmentDialog(false)}
        cohortId={cohortId}
        onEnrollmentSuccess={handleEnrollmentSuccess}
      />

      <DeleteCohortModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        cohortName={cohort?.name ?? ""}
        cohortId={cohortId}
        onDeleted={handleDeleteSuccess}
      />

      <AssignExaminerModal
        isOpen={showAssignExaminer}
        onClose={() => setShowAssignExaminer(false)}
        cohortId={cohortId}
        onAssigned={handleExaminerAssigned}
      />

      <PublishResultsModal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        cohort={cohort}
        saving={resultsToggling}
        onSave={handleSaveResultsPublish}
      />
    </div>
  );
}
