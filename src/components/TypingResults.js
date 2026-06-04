"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Eye,
  Trash2,
  Clock,
  Target,
  TrendingUp,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  FileText,
  Award,
  Mail,
  Phone,
} from "lucide-react";
import DeleteAttemptModal from "./DeleteAttemptModal";
import { useMessages } from "./MessageSystem";
import { generatePDF } from "./PDFExport";
import { getSubmissionReasonLabel } from "../lib/submissionReasons";

export default function TypingResults({ interviewId }) {
  const [results, setResults] = useState([]);
  const [interview, setInterview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const { showSuccess, showError } = useMessages();
  const fetchingRef = useRef(false);

  const fetchResults = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      const response = await fetch(`/api/interviews/${interviewId}/results`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setResults(result.data.results || []);
        setInterview(result.data.interview);
        setError(null);
      } else {
        console.error("Failed to load typing results");
        setError("Failed to load typing results");
      }
    } catch (error) {
      console.error("Error fetching typing results:", error);
      setError("Failed to load typing results");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [interviewId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleViewAttempt = (attempt) => {
    setSelectedAttempt(attempt);
    setShowAttemptModal(true);
  };

  const handleExportResults = async () => {
    if (exportingExcel) return;
    try {
      setExportingExcel(true);
      const response = await fetch(
        `/api/interviews/${interviewId}/export-results`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `typing-results-${interviewId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showSuccess("Results exported successfully");
      } else {
        showError("Failed to export results");
      }
    } catch (error) {
      console.error("Error exporting results:", error);
      showError("Failed to export results");
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePDFExport = async () => {
    if (exportingPDF) return;
    try {
      setExportingPDF(true);
      const filename = `typing-interview-${interviewId}-results-${new Date()
        .toISOString()
        .split("T")[0]
        .replace(/-/g, "")}.pdf`;

      await generatePDF(
        {
          interview,
          results,
        },
        filename
      );
      showSuccess("PDF export downloaded");
    } catch (error) {
      console.error("PDF Export error:", error);
      showError("Failed to generate PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "IN_PROGRESS":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "ABANDONED":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "ABANDONED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const calculatePercentage = (score, totalPoints) => {
    if (!totalPoints || totalPoints === 0) return 0;
    return Math.round((score / totalPoints) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading typing results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchResults}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {interview?.type} Interview Results
          </h3>
          <p className="text-sm text-gray-500">
            {results.length} attempt{results.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handlePDFExport}
            disabled={exportingPDF || exportingExcel}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exportingPDF ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exporting PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Export to PDF
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportResults}
            disabled={exportingExcel || exportingPDF}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exportingExcel ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Table */}
      {results.length === 0 ? (
        <div className="text-center p-8">
          <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Attempts Yet
          </h3>
          <p className="text-gray-500">No attempts found for this interview.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Access Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Speed (WPM)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score (Points)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr
                    key={result.attemptId}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {result.candidateName}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {result.candidateEmail}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {result.candidatePhone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                        {result.accessKey}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(result.duration)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(result.startTime)} -{" "}
                        {formatDateTime(result.endTime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          result.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : result.status === "IN_PROGRESS"
                            ? "bg-yellow-100 text-yellow-800"
                            : result.status === "STARTED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {result.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        {result.typingStats?.netWordsPerMinute ?? result.typingStats?.wordsPerMinute ?? 0} WPM
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        <Target className="h-4 w-4 mr-1 text-blue-600" />
                        {result.typingStats?.accuracy || 0}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {result.score} / {result.totalPoints} pts
                      </div>
                      <div className="text-sm text-gray-500">
                        {calculatePercentage(result.score, result.totalPoints)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedAttempt(result);
                            setShowAttemptModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                          title="View details"
                          aria-label="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setAttemptToDelete(result)}
                          className="text-red-600 hover:text-red-800 flex items-center"
                          title="Delete attempt"
                          aria-label="Delete attempt"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal - portaled to body so it floats above parent */}
      {showAttemptModal && selectedAttempt && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-gray-600/30 overflow-y-auto h-full w-full z-[9999]">
          <div className="relative top-8 mx-auto p-4 border w-11/12 max-w-4xl max-h-[94vh] shadow-lg rounded-lg bg-white my-4 flex flex-col">
            {/* Compact header row */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowAttemptModal(false)}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <span className="text-gray-300">|</span>
                <span className="font-medium text-gray-900">{selectedAttempt.candidateName}</span>
                <span className="text-sm text-gray-500">
                  {selectedAttempt.score}/{selectedAttempt.totalPoints} pts
                  ({calculatePercentage(selectedAttempt.score, selectedAttempt.totalPoints)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAttemptToDelete(selectedAttempt);
                    setShowAttemptModal(false);
                  }}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </button>
                <button onClick={() => setShowAttemptModal(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">✕</button>
              </div>
            </div>

            {/* Single compact summary bar */}
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm flex-shrink-0 mb-3">
              <span><span className="text-gray-500">Email:</span> {selectedAttempt.candidateEmail}</span>
              <span><span className="text-gray-500">Key:</span> <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs">{selectedAttempt.accessKey}</span></span>
              <span><span className="text-gray-500">WPM:</span> {selectedAttempt.typingStats?.netWordsPerMinute ?? selectedAttempt.typingStats?.wordsPerMinute ?? 0}</span>
              <span><span className="text-gray-500">Accuracy:</span> {selectedAttempt.typingStats?.accuracy ?? 0}%</span>
              <span><span className="text-gray-500">Words:</span> {selectedAttempt.typingStats?.wordsTyped ?? 0}</span>
              <span><span className="text-gray-500">Duration:</span> {formatDuration(selectedAttempt.duration)}</span>
              <span><span className="text-gray-500">Submitted:</span> {getSubmissionReasonLabel(selectedAttempt.submissionReason)}</span>
            </div>

            {/* Typed text - main scrollable area */}
            <div className="flex-1 min-h-0 flex flex-col">
              <h4 className="font-medium text-gray-900 mb-2 flex-shrink-0">Typed Text</h4>
              <div className="bg-gray-50 rounded-lg p-4 border overflow-y-auto min-h-0 flex-1">
                <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono">
                  {selectedAttempt.questions?.[0]?.userAnswer ||
                    selectedAttempt.questions?.[0]?.candidateAnswer ||
                    "No text recorded"}
                </pre>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <DeleteAttemptModal
        isOpen={!!attemptToDelete}
        onClose={() => setAttemptToDelete(null)}
        attempt={attemptToDelete}
        interviewId={interviewId}
        onDeleted={() => {
          setAttemptToDelete(null);
          fetchResults();
          showSuccess("Attempt deleted successfully.");
        }}
      />
    </div>
  );
}
