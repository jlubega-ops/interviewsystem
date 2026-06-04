"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Mail,
  Phone,
  Key,
  MoreVertical,
  Trash2,
  RefreshCw,
  UserX,
  UserCheck,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Edit3,
  Save,
  X,
  CheckCircle,
} from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";
import ConfirmationDialog from "./ConfirmationDialog";

export default function EnrolledCandidates({ cohortId, onEnrollmentSuccess }) {
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [unenrollConfirm, setUnenrollConfirm] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [newAccessKey, setNewAccessKey] = useState("");
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchCandidates = useCallback(async () => {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/cohorts/${cohortId}/enrollments`);
      if (response.ok) {
        const result = await response.json();
        setCandidates(result.enrollments || []);
      } else {
        showError("Failed to load candidates");
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
      showError("Failed to load candidates");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [cohortId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Refetch candidates when enrollment success is triggered
  useEffect(() => {
    if (onEnrollmentSuccess) {
      fetchCandidates();
    }
  }, [onEnrollmentSuccess, fetchCandidates]);

  const handleDownloadCandidates = async () => {
    try {
      const response = await fetch(
        `/api/cohorts/${cohortId}/candidates/export`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        showError("Failed to download candidates");
        return;
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : "candidates.csv";

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccess("Candidates exported successfully");
    } catch (error) {
      console.error("Error downloading candidates:", error);
      showError("Failed to download candidates");
    }
  };

  const handleUnenrollClick = (enrollmentId, candidateName) => {
    setUnenrollConfirm({ enrollmentId, candidateName });
  };

  const handleUnenrollConfirm = async () => {
    if (!unenrollConfirm) return;
    const { enrollmentId } = unenrollConfirm;
    setUnenrollConfirm(null);
    setActionLoading(enrollmentId);

    try {
      const response = await fetch(
        `/api/cohorts/${cohortId}/enrollments/${enrollmentId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || "Failed to unenroll candidate");
        return;
      }

      showSuccess("Candidate unenrolled successfully");
      setCandidates((prev) => prev.filter((c) => c.id !== enrollmentId));
    } catch (err) {
      console.error("Error unenrolling candidate:", err);
      showError("Failed to unenroll candidate");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (enrollmentId, action, candidateName) => {
    setActionLoading(enrollmentId);

    try {
      const response = await fetch(
        `/api/cohorts/${cohortId}/enrollments/${enrollmentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || `Failed to ${action} candidate`);
        return;
      }

      let message = "";
      switch (action) {
        case "suspend":
          message = "Candidate suspended successfully";
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === enrollmentId ? { ...c, status: "UNENROLLED" } : c
            )
          );
          break;
        case "activate":
          message = "Candidate activated successfully";
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === enrollmentId ? { ...c, status: "ENROLLED" } : c
            )
          );
          break;
        case "reset_access":
          message = "Access key reset successfully";
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === enrollmentId
                ? { ...c, accessKey: result.enrollment.accessKey }
                : c
            )
          );
          break;
      }

      showSuccess(message);
    } catch (error) {
      console.error(`Error ${action} candidate:`, error);
      showError(`Failed to ${action} candidate`);
    } finally {
      setActionLoading(null);
    }
  };

  const copyAccessKey = async (accessKey) => {
    try {
      await navigator.clipboard.writeText(accessKey);
      setCopiedKey(accessKey);
      showSuccess("Access key copied to clipboard");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      showError("Failed to copy access key");
    }
  };

  const startEditingKey = (enrollmentId, currentKey) => {
    setEditingKey(enrollmentId);
    setNewAccessKey(currentKey);
  };

  const cancelEditingKey = () => {
    setEditingKey(null);
    setNewAccessKey("");
  };

  const saveAccessKey = async (enrollmentId) => {
    if (!newAccessKey.trim()) {
      showError("Access key cannot be empty");
      return;
    }

    try {
      setActionLoading(enrollmentId);
      const response = await fetch(
        `/api/cohorts/${cohortId}/enrollments/${enrollmentId}/access-key`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ accessKey: newAccessKey.trim() }),
        }
      );

      if (response.ok) {
        showSuccess("Access key updated successfully");
        setEditingKey(null);
        setNewAccessKey("");
        fetchCandidates(); // Refresh the list
      } else {
        const result = await response.json();
        showError(result.error || "Failed to update access key");
      }
    } catch (error) {
      console.error("Error updating access key:", error);
      showError("Failed to update access key");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ENROLLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <UserCheck className="w-3 h-3 mr-1" />
            Enrolled
          </span>
        );
      case "UNENROLLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <UserX className="w-3 h-3 mr-1" />
            Suspended
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Unknown
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Candidates Enrolled
        </h3>
        <p className="text-gray-600">
          No candidates have been enrolled in this cohort yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Enrolled Candidates ({candidates.length})
          </h3>
          <p className="text-sm text-gray-600">
            Manage candidates enrolled in this cohort
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadCandidates}
            className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={fetchCandidates}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Candidates List */}
      <div className="space-y-4">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {candidate.candidate.fullName}
                  </h4>
                  {getStatusBadge(candidate.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>{candidate.candidate.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>{candidate.candidate.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <div className="flex items-center space-x-2">
                      {editingKey === candidate.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={newAccessKey}
                            onChange={(e) => setNewAccessKey(e.target.value)}
                            className="font-mono text-xs border border-gray-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                            placeholder="Enter new access key"
                            autoFocus
                          />
                          <button
                            onClick={() => saveAccessKey(candidate.id)}
                            disabled={actionLoading === candidate.id}
                            className="p-1 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                            title="Save access key"
                          >
                            {actionLoading === candidate.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={cancelEditingKey}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Cancel editing"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {candidate.accessKey}
                          </span>
                          <button
                            onClick={() => copyAccessKey(candidate.accessKey)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy access key"
                          >
                            {copiedKey === candidate.accessKey ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              startEditingKey(candidate.id, candidate.accessKey)
                            }
                            className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
                            title="Edit access key"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Enrolled: {new Date(candidate.enrolledAt).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {candidate.status === "ENROLLED" ? (
                  <button
                    onClick={() =>
                      handleAction(
                        candidate.id,
                        "suspend",
                        candidate.candidate.fullName
                      )
                    }
                    disabled={actionLoading === candidate.id}
                    className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Suspend candidate"
                  >
                    {actionLoading === candidate.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleAction(
                        candidate.id,
                        "activate",
                        candidate.candidate.fullName
                      )
                    }
                    disabled={actionLoading === candidate.id}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Activate candidate"
                  >
                    {actionLoading === candidate.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  onClick={() =>
                    handleAction(
                      candidate.id,
                      "reset_access",
                      candidate.candidate.fullName
                    )
                  }
                  disabled={actionLoading === candidate.id}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Reset access key"
                >
                  {actionLoading === candidate.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() =>
                    handleUnenrollClick(
                      candidate.id,
                      candidate.candidate.fullName
                    )
                  }
                  disabled={actionLoading === candidate.id}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Unenroll candidate"
                >
                  {actionLoading === candidate.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmationDialog
        isOpen={!!unenrollConfirm}
        onClose={() => setUnenrollConfirm(null)}
        onConfirm={handleUnenrollConfirm}
        title="Unenroll candidate"
        message={
          unenrollConfirm ? (
            <>
              <p className="mb-2">
                Are you sure you want to unenroll <strong>{unenrollConfirm.candidateName}</strong> from this cohort?
              </p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mt-2">
                <strong>Warning:</strong> All of this candidate&apos;s attempts (and answers) in this cohort will be permanently deleted. Their access key for this cohort will be removed. They will remain enrolled in other cohorts if applicable.
              </div>
            </>
          ) : (
            ""
          )
        }
        type="danger"
        confirmText="Unenroll"
        cancelText="Cancel"
        isLoading={!!actionLoading}
      />
    </div>
  );
}
