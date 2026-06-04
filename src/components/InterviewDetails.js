"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Clock,
  Users,
  BarChart3,
  Calendar,
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
  ExternalLink,
  Edit3,
  X,
} from "lucide-react";
import { useMessages } from "./MessageSystem";
import { sanitizeHtml } from "../lib/sanitize";
import InterviewResults from "./InterviewResults";
import QuestionCards from "./QuestionCards";
import EditInterviewDialog from "./EditInterviewDialog";
import BulkQuestionUpload from "./BulkQuestionUpload";
import LoadFromQuestionBank from "./LoadFromQuestionBank";
import TypingQuestionCards from "./TypingQuestionCards";
import TypingResults from "./TypingResults";

export default function InterviewDetails({ interviewId }) {
  const [interview, setInterview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showLoadFromBank, setShowLoadFromBank] = useState(false);
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchInterview = useCallback(async () => {
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      // Fetching interview details

      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Response received

      if (response.ok) {
        const result = await response.json();
        // Interview data received
        setInterview(result.interview);
      } else {
        const errorData = await response.json();
        // API error occurred

        if (response.status === 401) {
          // Unauthorized - redirecting to login
          showError("Authentication failed. Please log in again.");
          setTimeout(() => {
            window.location.href = "/admin/login";
          }, 2000);
        } else {
          showError(
            `Failed to load interview details: ${
              errorData.error || "Unknown error"
            }`
          );
        }
      }
    } catch (error) {
      console.error("Error fetching interview:", error);
      showError("Failed to load interview details");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [interviewId]);

  useEffect(() => {
    fetchInterview();
  }, [fetchInterview]);

  const handleAction = async (interviewId, action) => {
    try {
      setActionLoading(interviewId);

      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        showSuccess(result.message);
        fetchInterview(); // Refresh the list
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to perform action");
      }
    } catch (error) {
      console.error("Error performing action:", error);
      showError("Failed to perform action");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInterviewUpdated = (updatedInterview) => {
    setInterview(updatedInterview);
    setShowEditDialog(false);
  };

  const handleBulkUploadComplete = () => {
    setShowBulkUpload(false);
    // Refresh the interview data to update question count
    fetchInterview();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview details...</p>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Interview Not Found</h1>
        <p className="text-gray-600">
          The interview with ID {interviewId} could not be found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Interview Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {interview.type} Interview
                </h1>
                <div
                  className="text-gray-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(interview.description || "No description provided"),
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-semibold">
                    {interview.durationMinutes} minutes
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Type className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Questions</p>
                  <p className="font-semibold">
                    {interview.questions?.length || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Cohort</p>
                  <p className="font-semibold">
                    {interview.cohort?.name || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-semibold">{interview.type || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEditDialog(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={() =>
                handleAction(
                  interview.id,
                  interview.isHidden ? "unhide" : "hide"
                )
              }
              disabled={actionLoading === interview.id}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {actionLoading === interview.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : interview.isHidden ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <span>{interview.isHidden ? "Show" : "Hide"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("questions")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "questions"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {interview?.type === "TYPING"
                ? "Configuration"
                : `Questions (${interview.questions?.length || 0})`}
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "results"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {interview?.type === "TYPING" ? "Typing Results" : "Results"}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Interview Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium">#{interview.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{interview.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">
                        {interview.durationMinutes} minutes
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Questions:</span>
                      <span className="font-medium">
                        {interview.questions?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={`font-medium ${
                          interview.isHidden ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {interview.isHidden ? "Hidden" : "Visible"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Cohort Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cohort:</span>
                      <span className="font-medium">
                        {interview.cohort?.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Open Time:</span>
                      <span className="font-medium">
                        {interview.cohort?.openTime
                          ? new Date(interview.cohort.openTime).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Close Time:</span>
                      <span className="font-medium">
                        {interview.cohort?.closeTime
                          ? new Date(
                              interview.cohort.closeTime
                            ).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "questions" && (
            <div>
              {interview?.type === "TYPING" ? (
                // Typing Interview - Special layout
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Typing Interview Configuration
                      </h3>
                      <p className="text-sm text-gray-600">
                        Configure the typing test for this interview
                      </p>
                    </div>
                  </div>
                  <TypingQuestionCards interviewId={interviewId} />
                </div>
              ) : (
                // Regular Interview - Standard layout
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-4">
                      {showBulkUpload && (
                        <button
                          onClick={() => setShowBulkUpload(false)}
                          className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Back to Questions
                        </button>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {showBulkUpload
                          ? "Bulk Upload Questions"
                          : "Interview Questions"}
                      </h3>
                    </div>
                    {!showBulkUpload && (
                      <>
                        <button
                          onClick={() => setShowLoadFromBank(true)}
                          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Load from question bank
                        </button>
                        <button
                          onClick={() => setShowBulkUpload(true)}
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Upload questions from file
                        </button>
                      </>
                    )}
                  </div>
                  {showBulkUpload ? (
                    <BulkQuestionUpload
                      interviewId={interviewId}
                      onUploadComplete={handleBulkUploadComplete}
                    />
                  ) : (
                    <QuestionCards interviewId={interviewId} />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "results" && (
            <div>
              {interview?.type === "TYPING" ? (
                // Typing Interview - Special results layout
                <TypingResults interviewId={interviewId} />
              ) : (
                // Regular Interview - Standard results layout
                <InterviewResults
                  interviewId={interviewId}
                  interviewType={interview.type}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Interview Dialog */}
      <EditInterviewDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        interview={interview}
        onInterviewUpdated={handleInterviewUpdated}
      />

      {/* Load from question bank */}
      <LoadFromQuestionBank
        isOpen={showLoadFromBank}
        onClose={() => setShowLoadFromBank(false)}
        interviewId={interviewId}
        onLoadComplete={fetchInterview}
      />
    </div>
  );
}
