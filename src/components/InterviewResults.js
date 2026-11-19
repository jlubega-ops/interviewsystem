"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Trash2,
  Clock,
  User,
  Mail,
  Phone,
  Award,
  ArrowLeft,
  FileText,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { generatePDF } from "./PDFExport";
import { htmlToPlainText } from "../lib/sanitize";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager, onTableRowClick } from "./ClientTableChrome";
import QuestionOptionsPanel from "./QuestionOptionsPanel";
import { useExpandableIds } from "../hooks/useExpandableIds";
import { getSubmissionReasonLabel } from "../lib/submissionReasons";
import DeleteAttemptModal from "./DeleteAttemptModal";
import DeleteAttemptsBulkModal from "./DeleteAttemptsBulkModal";
import { useMessages } from "./MessageSystem";

export default function InterviewResults({ interviewId, interviewType }) {
  const { showSuccess, showError } = useMessages();
  const [results, setResults] = useState([]);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const resultQuestionIds = (selectedAttempt?.questions || []).map(
    (q) => q.questionId || q.questionNumber
  );
  const optionExpand = useExpandableIds(resultQuestionIds);

  const table = useClientTable(results, {
    pageSize: 10,
    searchText: (r) =>
      [
        r.candidateName,
        r.candidateEmail,
        r.candidatePhone,
        r.accessKey,
        r.status,
      ].join(" "),
  });
  const allIds = table.filtered.map((r) => r.attemptId).filter(Boolean);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const toggleSelect = (attemptId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  };

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/interviews/${interviewId}/results`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      setResults(data.data.results || []);
      setInterview(data.data.interview);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleExport = async () => {
    if (exportingExcel) return;
    try {
      setExportingExcel(true);
      const response = await fetch(
        `/api/interviews/${interviewId}/export-results`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export results");
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-${interviewType}-results.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess("Excel export downloaded");
    } catch (err) {
      console.error("Export failed:", err);
      showError("Failed to export results");
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePDFExport = async () => {
    if (exportingPDF) return;
    try {
      setExportingPDF(true);
      const filename = `interview-${interviewId}-results-${new Date()
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

  const calculatePercentage = (score, totalQuestions) => {
    if (!totalQuestions || totalQuestions === 0) return 0;
    return Math.round((score / totalQuestions) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchResults}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8">
        <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Attempts Yet
        </h3>
        <p className="text-gray-500">No attempts found for this interview.</p>
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
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete selected ({selectedCount})
            </button>
          )}
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
            onClick={handleExport}
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-3 border-b border-gray-200">
          <TableSearch
            query={table.query}
            setQuery={table.setQuery}
            placeholder="Search attempts..."
            filteredCount={table.filteredCount}
            totalCount={table.totalCount}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    All
                  </label>
                </th>
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
                  Score (Points)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.pageRows.map((result, index) => (
                <tr
                  key={result.attemptId}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} cursor-pointer hover:bg-blue-50`}
                  onClick={onTableRowClick(() => {
                    setSelectedAttempt(result);
                    setShowDetails(true);
                  })}
                >
                  <td className="px-4 py-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(result.attemptId)}
                      onChange={() => toggleSelect(result.attemptId)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
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
                    <div className="text-sm font-medium text-gray-900">
                      {result.score} / {result.totalPoints} pts
                    </div>
                    <div className="text-sm text-gray-500">
                      {calculatePercentage(result.score, result.totalPoints)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {result.answeredQuestions} / {result.totalQuestions}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (result.answeredQuestions / result.totalQuestions) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
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
        <TablePager
          page={table.page}
          setPage={table.setPage}
          totalPages={table.totalPages}
          filteredCount={table.filteredCount}
          pageSize={table.pageSize}
        />
      </div>

      {/* Details Modal - portaled to body so it floats above parent */}
      {showDetails && selectedAttempt && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-gray-600/30 overflow-y-auto h-full w-full z-[9999]">
          <div className="relative top-8 mx-auto p-4 border w-11/12 max-w-4xl max-h-[94vh] shadow-lg rounded-lg bg-white my-4 flex flex-col">
            {/* Compact header row */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowDetails(false)}
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
                    setShowDetails(false);
                  }}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </button>
                <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">✕</button>
              </div>
            </div>

            {/* Single compact summary bar: candidate + performance */}
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm flex-shrink-0 mb-3">
              <span><span className="text-gray-500">Email:</span> {selectedAttempt.candidateEmail}</span>
              <span><span className="text-gray-500">Key:</span> <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs">{selectedAttempt.accessKey}</span></span>
              <span><span className="text-gray-500">Answered:</span> {selectedAttempt.answeredQuestions}/{selectedAttempt.totalQuestions}</span>
              <span><span className="text-gray-500">Duration:</span> {formatDuration(selectedAttempt.duration)}</span>
              <span><span className="text-gray-500">Submitted:</span> {getSubmissionReasonLabel(selectedAttempt.submissionReason)}</span>
            </div>

            {/* Question responses - main scrollable area */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h4 className="font-medium text-gray-900">Question Responses</h4>
                <button
                  type="button"
                  onClick={optionExpand.toggleAll}
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  {optionExpand.allExpanded ? (
                    <ChevronsDownUp className="w-4 h-4" />
                  ) : (
                    <ChevronsUpDown className="w-4 h-4" />
                  )}
                  {optionExpand.allExpanded ? "Collapse all options" : "Expand all options"}
                </button>
              </div>
              <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
                    {selectedAttempt.questions.map((q, index) => {
                      const qKey = q.questionId || q.questionNumber || index;
                      return (
                      <div
                        key={qKey}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">
                            Question {q.questionNumber}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              q.unanswered
                                ? "bg-gray-100 text-gray-700"
                                : q.isCorrect
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {q.unanswered ? "Not answered" : q.isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          {htmlToPlainText(q.questionText)}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">
                              Candidate Answer:
                            </span>{" "}
                            {q.unanswered ? "Not answered" : q.candidateAnswer || "No answer"}
                          </div>
                          <div>
                            <span className="text-gray-500">
                              Correct Answer:
                            </span>{" "}
                            {q.correctAnswer}
                          </div>
                        </div>
                        <QuestionOptionsPanel
                          options={q.options}
                          correctAnswer={q.correctAnswer}
                          candidateAnswer={q.unanswered ? "" : q.candidateAnswer}
                          showCorrect
                          expanded={optionExpand.isExpanded(qKey)}
                          onToggle={() => optionExpand.toggle(qKey)}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Points: {q.pointsEarned} / {q.points}
                        </div>
                      </div>
                      );
                    })}
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
          setSelectedIds(new Set());
          fetchResults();
          showSuccess("Attempt deleted successfully.");
        }}
      />

      <DeleteAttemptsBulkModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        attemptIds={Array.from(selectedIds)}
        interviewId={interviewId}
        onDeleted={() => {
          setShowBulkDeleteModal(false);
          setSelectedIds(new Set());
          fetchResults();
          showSuccess("Selected attempts deleted successfully.");
        }}
      />
    </div>
  );
}
