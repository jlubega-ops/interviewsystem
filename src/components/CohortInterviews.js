"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  Type,
  Eye,
  EyeOff,
  Trash2,
  MoreVertical,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  User,
  Calendar,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";
import { sanitizeHtml } from "../lib/sanitize";
import InterviewDialog from "./InterviewDialog";
import EditInterviewDialog from "./EditInterviewDialog";
import DeleteInterviewModal from "./DeleteInterviewModal";

export default function CohortInterviews({ cohortId }) {
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const router = useRouter();
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchInterviews = useCallback(async () => {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/cohorts/${cohortId}/interviews`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setInterviews(result.interviews || []);
      } else {
        showError("Failed to load interviews");
      }
    } catch (error) {
      console.error("Error fetching interviews:", error);
      showError("Failed to load interviews");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [cohortId]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const handleDeleteClick = (interviewId, interviewTitle) => {
    setDeleteConfirm({ interviewId, interviewTitle });
  };

  const handleDeleteSuccess = () => {
    if (deleteConfirm) {
      showSuccess("Interview deleted successfully");
      setInterviews((prev) => prev.filter((i) => i.id !== deleteConfirm.interviewId));
      setDeleteConfirm(null);
    }
  };

  const handleAction = async (interviewId, action, interviewTitle) => {
    setActionLoading(interviewId);

    try {
      const response = await fetch(
        `/api/cohorts/${cohortId}/interviews/${interviewId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ action }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || `Failed to ${action} interview`);
        return;
      }

      let message = "";
      switch (action) {
        case "hide":
          message = "Interview hidden successfully";
          setInterviews((prev) =>
            prev.map((i) =>
              i.id === interviewId ? { ...i, isHidden: true } : i
            )
          );
          break;
        case "unhide":
          message = "Interview unhidden successfully";
          setInterviews((prev) =>
            prev.map((i) =>
              i.id === interviewId ? { ...i, isHidden: false } : i
            )
          );
          break;
        default:
          break;
      }

      showSuccess(message);
    } catch (error) {
      console.error(`Error ${action}ing interview:`, error);
      showError(`Failed to ${action} interview`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInterviewSuccess = (interview) => {
    fetchInterviews();
  };

  const handleEditInterview = (interview) => {
    setSelectedInterview(interview);
    setShowEditDialog(true);
  };

  const handleInterviewUpdated = (updatedInterview) => {
    setInterviews((prev) =>
      prev.map((interview) =>
        interview.id === updatedInterview.id ? updatedInterview : interview
      )
    );
    setShowEditDialog(false);
    setSelectedInterview(null);
  };

  const getTypeBadge = (type) => {
    const colors = {
      APTITUDE: "bg-blue-100 text-blue-800",
      TYPING: "bg-green-100 text-green-800",
      ORAL: "bg-purple-100 text-purple-800",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          colors[type] || "bg-gray-100 text-gray-800"
        }`}
      >
        <Type className="w-3 h-3 mr-1" />
        {type}
      </span>
    );
  };

  const getStatusBadge = (interview) => {
    if (interview.isHidden) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <EyeOff className="w-3 h-3 mr-1" />
          Hidden
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading interviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Interviews</h3>
          <p className="text-sm text-gray-600">
            Manage interviews for this cohort
          </p>
        </div>
        <button
          onClick={() => setShowInterviewDialog(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Interview</span>
        </button>
      </div>

      {/* Interviews List */}
      {interviews.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No interviews yet
          </h3>
          <p className="text-gray-600 mb-4">
            Add interviews to this cohort to get started.
          </p>
          <button
            onClick={() => setShowInterviewDialog(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Interview</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {interviews.map((interview) => {
            return (
              <div
                key={interview.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/admin/interviews/${interview.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {interview.type || interview.interviewType || "Unknown"}{" "}
                        Assessment
                      </h4>
                      {getTypeBadge(interview.type || interview.interviewType)}
                      {getStatusBadge(interview)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>{interview.durationMinutes} minutes</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Created by {interview.creator.fullName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(interview.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {interview.instructions && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Instructions:
                        </h5>
                        <div
                          className="text-sm text-gray-600 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(interview.instructions),
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/interviews/${interview.id}`);
                      }}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View interview details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInterview(interview);
                      }}
                      className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                      title="Edit interview"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {interview.isHidden ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(
                            interview.id,
                            "unhide",
                            `${
                              interview.type ||
                              interview.interviewType ||
                              "Unknown"
                            } Assessment`
                          );
                        }}
                        disabled={actionLoading === interview.id}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Unhide interview"
                      >
                        {actionLoading === interview.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(
                            interview.id,
                            "hide",
                            `${
                              interview.type ||
                              interview.interviewType ||
                              "Unknown"
                            } Assessment`
                          );
                        }}
                        disabled={actionLoading === interview.id}
                        className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Hide interview"
                      >
                        {actionLoading === interview.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(
                          interview.id,
                          `${
                            interview.type ||
                            interview.interviewType ||
                            "Unknown"
                          } Assessment`
                        );
                      }}
                      disabled={actionLoading === interview.id}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete interview"
                    >
                      {actionLoading === interview.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interview Dialog */}
      <InterviewDialog
        isOpen={showInterviewDialog}
        onClose={() => setShowInterviewDialog(false)}
        cohortId={cohortId}
        onInterviewSuccess={handleInterviewSuccess}
      />

      {/* Edit Interview Dialog */}
      <EditInterviewDialog
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedInterview(null);
        }}
        interview={selectedInterview}
        onInterviewUpdated={handleInterviewUpdated}
      />

      <DeleteInterviewModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        interviewTitle={deleteConfirm?.interviewTitle ?? ""}
        interviewId={deleteConfirm?.interviewId}
        cohortId={cohortId}
        onDeleted={handleDeleteSuccess}
      />
    </div>
  );
}
