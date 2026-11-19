"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Filter,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import NavigationHeader from "./NavigationHeader";

const ACTION_TYPE_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "LOGIN_SUCCESS", label: "Login Success" },
  { value: "LOGIN_FAILED", label: "Login Failed" },
  { value: "LOGIN_SUSPENDED", label: "Login Suspended" },
  { value: "LOGIN_NOT_ACTIVATED", label: "Login Not Activated" },
  { value: "LOGOUT", label: "Logout" },
  { value: "VIEW_COHORTS", label: "View Cohorts" },
  { value: "VIEW_COHORT", label: "View Cohort" },
  { value: "CREATE_COHORT", label: "Create Cohort" },
  { value: "EDIT_COHORT", label: "Edit Cohort" },
  { value: "DELETE_COHORT", label: "Delete Cohort" },
  { value: "ASSIGN_EXAMINER", label: "Assign Examiner" },
  { value: "UNASSIGN_EXAMINER", label: "Unassign Examiner" },
  { value: "CREATE_INTERVIEW", label: "Create Interview" },
  { value: "DELETE_INTERVIEW", label: "Delete Interview" },
  { value: "VIEW_INTERVIEW", label: "View Interview" },
  { value: "ASSIGN_CANDIDATE", label: "Assign Candidate" },
  { value: "UNASSIGN_CANDIDATE", label: "Unassign Candidate" },
  { value: "UPLOAD_CANDIDATES", label: "Upload Candidates" },
  { value: "VIEW_RESULTS", label: "View Results" },
  { value: "VIEW_ATTEMPTS", label: "View Attempts" },
  { value: "EXPORT_ATTEMPTS", label: "Export Attempts" },
  { value: "DELETE_ATTEMPT", label: "Delete Attempt" },
  { value: "TOGGLE_INTERVIEW_VISIBILITY", label: "Toggle Interview Visibility" },
  { value: "VIEW_USERS", label: "View Users" },
  { value: "VIEW_USER", label: "View User" },
  { value: "CREATE_USER", label: "Create User" },
  { value: "EDIT_USER", label: "Edit User" },
  { value: "DELETE_USER", label: "Delete User" },
  { value: "SUSPEND_USER", label: "Suspend User" },
  { value: "UNSUSPEND_USER", label: "Unsuspend User" },
  { value: "RESEND_ACTIVATION", label: "Resend Activation" },
  { value: "RESET_PASSWORD_EMAIL", label: "Reset Password Email" },
  { value: "CREATE_ORGANISATION", label: "Create Organisation" },
  { value: "EDIT_ORGANISATION", label: "Edit Organisation" },
  { value: "DELETE_ORGANISATION", label: "Delete Organisation" },
  { value: "VIEW_PROFILE", label: "View Profile" },
  { value: "UPDATE_PROFILE", label: "Update Profile" },
  { value: "CANDIDATE_VIEW_HOME", label: "Candidate View Home" },
  { value: "CANDIDATE_LOGIN_SUCCESS", label: "Candidate Login" },
  { value: "CANDIDATE_LOGIN_FAILED", label: "Candidate Login Failed" },
  { value: "CANDIDATE_INVALID_KEY", label: "Candidate Invalid Key" },
  { value: "CANDIDATE_LOGOUT", label: "Candidate Logout" },
  { value: "CANDIDATE_STARTED_INTERVIEW", label: "Candidate Started Interview" },
  { value: "CANDIDATE_INTERVIEW_START_FAILED", label: "Candidate Interview Start Failed" },
  { value: "CANDIDATE_INTERVIEW_SUBMITTED", label: "Candidate Interview Submitted" },
  { value: "CANDIDATE_LEFT_SCREEN", label: "Candidate Left Screen" },
  { value: "CANDIDATE_HIDDEN_INTERVIEW", label: "Candidate Hidden Interview" },
  { value: "CANDIDATE_VIEW_ATTEMPTS", label: "Candidate View Attempts" },
  { value: "VIEW_LOG_DETAIL", label: "View Log Detail" },
  { value: "VIEW_REPORTS", label: "View Reports" },
];

/** Title case: each word capitalised (e.g. LOGIN_SUCCESS → "Login Success") */
function formatActionType(str) {
  if (!str) return "—";
  return str
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short label for table: remove outcome suffix so details stay in description (e.g. "Candidate Login Success" → "Candidate Login") */
const ACTION_SHORT_SUFFIXES = [
  " Success", " Failed", " Suspended", " Not Activated", " Invalid Key",
  " Start Failed", " Submitted", " Left Screen", " Hidden Interview", " View Attempts",
  " Email", " Activation", " Password Email",
];
function formatActionTypeShort(str) {
  if (!str) return "—";
  let label = formatActionType(str);
  for (const suffix of ACTION_SHORT_SUFFIXES) {
    if (label.endsWith(suffix)) {
      label = label.slice(0, -suffix.length);
      break;
    }
  }
  return label;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionType, setActionType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [profileUser, setProfileUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [candidateProfileLoading, setCandidateProfileLoading] = useState(false);
  const [viewLogDetail, setViewLogDetail] = useState(null);

  const fetchLogs = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (actionType) params.set("actionType", actionType);
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("limit", "50");
        const res = await fetch(`/api/logs?${params}`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 403) {
            setError("You do not have permission to view logs.");
            return;
          }
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to load logs");
          return;
        }
        const data = await res.json();
        setLogs(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
      } catch (e) {
        setError("Failed to load logs");
      } finally {
        setIsLoading(false);
      }
    },
    [from, to, actionType, search]
  );

  useEffect(() => {
    verifyAndFetch();
  }, []);

  const verifyAndFetch = async () => {
    try {
      const verify = await fetch("/api/auth/verify", { method: "GET", credentials: "include" });
      if (!verify.ok) {
        window.location.href = "/admin/login";
        return;
      }
      const result = await verify.json();
      if (!["SUPERADMIN", "ADMIN"].includes(result.user?.role)) {
        setError("Only admins can view activity logs.");
        setIsLoading(false);
        return;
      }
      // Initial fetch is done by the useEffect with [from, to, actionType, search]
      fetchLogs(1);
    } catch {
      window.location.href = "/admin/login";
    }
  };

  // Refetch when filters change (skip first mount to avoid double fetch with verifyAndFetch)
  const filterEffectRan = useRef(false);
  useEffect(() => {
    if (!filterEffectRan.current) {
      filterEffectRan.current = true;
      return;
    }
    fetchLogs(1);
  }, [from, to, actionType, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleUserClick = async (log) => {
    if (log.actorType !== "USER" || !log.userId) return;
    setProfileLoading(true);
    setProfileUser(null);
    try {
      const res = await fetch(`/api/users/${log.userId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProfileUser(data.data);
      }
    } catch {
      setProfileUser(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCandidateClick = async (log) => {
    if (log.actorType !== "CANDIDATE" || !log.candidateId) return;
    setCandidateProfileLoading(true);
    setCandidateProfile(null);
    try {
      const res = await fetch(`/api/candidates/${log.candidateId}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setCandidateProfile(json.data);
      }
    } catch {
      setCandidateProfile(null);
    } finally {
      setCandidateProfileLoading(false);
    }
  };

  const handleViewLogDetail = (log) => {
    setViewLogDetail(log);
    fetch("/api/logs/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ actionType: "VIEW_LOG_DETAIL", logId: log?.id }),
    }).catch(() => {});
  };

  const getRoleColor = (role) => {
    if (!role) return "bg-gray-100 text-gray-800";
    const r = String(role).toUpperCase();
    if (r === "SUPERADMIN") return "bg-red-100 text-red-800";
    if (r === "ADMIN") return "bg-blue-100 text-blue-800";
    if (r === "EXAMINER") return "bg-green-100 text-green-800";
    if (r === "CANDIDATE") return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Activity Logs"
        subtitle="Audit trail of user and candidate actions"
        icon="FileText"
        showBackButton
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Logs", href: "/admin/logs" },
        ]}
      />

      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Filters and refresh */}
        <div className="mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-medium text-gray-900">Filters</h3>
            </div>
            <button
              type="button"
              onClick={() => fetchLogs(pagination.page)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search (name, email, organisation)</label>
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading logs...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User / Actor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cohort
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Interview
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => {
                      const d = log.createdAt ? new Date(log.createdAt) : null;
                      const dateStr = d ? d.toLocaleDateString() : "—";
                      const timeStr = d ? d.toLocaleTimeString() : "—";
                      const isUser = log.actorType === "USER" && log.userId;
                      const isCandidate = log.actorType === "CANDIDATE" && log.candidateId;
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={(event) => {
                            if (event.target.closest("a, button, input, select, textarea, label")) return;
                            handleViewLogDetail(log);
                          }}
                        >
                          <td className="px-4 py-3 text-sm">
                            {isUser ? (
                              <button
                                type="button"
                                onClick={() => handleUserClick(log)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left"
                              >
                                {log.actorName || log.actorEmail || "—"}
                              </button>
                            ) : isCandidate ? (
                              <button
                                type="button"
                                onClick={() => handleCandidateClick(log)}
                                className="text-amber-600 hover:text-amber-800 hover:underline font-medium text-left"
                              >
                                {log.actorName || log.actorEmail || "—"}
                              </button>
                            ) : (
                              <span className="text-gray-900">
                                {log.actorName || log.actorEmail || "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{dateStr}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{timeStr}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {formatActionTypeShort(log.actionType)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.resource || "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleColor(
                                log.actorRole
                              )}`}
                            >
                              {log.actorRole || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={log.targetCohortName || ""}>
                            {log.targetCohortName || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {log.targetInterviewType || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate" title={log.description}>
                            {log.description || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {logs.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No logs match your filters.</p>
                </div>
              )}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchLogs(pagination.page - 1)}
                      className="p-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLogs(pagination.page + 1)}
                      className="p-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Full log detail modal */}
      {viewLogDetail && (
        <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Log Details</h3>
              <button
                type="button"
                onClick={() => setViewLogDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Actor type</span>
                  <p className="text-gray-900 font-medium truncate">{viewLogDetail.actorType || "—"}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Date & time</span>
                  <p className="text-gray-900 truncate">
                    {viewLogDetail.createdAt ? new Date(viewLogDetail.createdAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Name</span>
                  <p className="text-gray-900 truncate">{viewLogDetail.actorName || "—"}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Role</span>
                  <p>
                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${getRoleColor(viewLogDetail.actorRole)}`}>
                      {viewLogDetail.actorRole || "—"}
                    </span>
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Email</span>
                  <p className="text-gray-900 truncate">{viewLogDetail.actorEmail || "—"}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Action</span>
                  <p className="text-gray-900 truncate">{formatActionTypeShort(viewLogDetail.actionType)}</p>
                </div>
                {viewLogDetail.actorOrg && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-500">Organisation</span>
                    <p className="text-gray-900 truncate">{viewLogDetail.actorOrg}</p>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500">Resource</span>
                  <p className="text-gray-900 truncate">{viewLogDetail.resource || "—"}</p>
                </div>
                {(viewLogDetail.targetCohortName || viewLogDetail.targetInterviewType) && (
                  <>
                    {viewLogDetail.targetCohortName && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-gray-500">Cohort</span>
                        <p className="text-gray-900 truncate">{viewLogDetail.targetCohortName}</p>
                      </div>
                    )}
                    {viewLogDetail.targetInterviewType && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-gray-500">Interview</span>
                        <p className="text-gray-900 truncate">{viewLogDetail.targetInterviewType}</p>
                      </div>
                    )}
                  </>
                )}
                {viewLogDetail.ipAddress && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-500">IP address</span>
                    <p className="text-gray-900 font-mono text-xs truncate">{viewLogDetail.ipAddress}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-gray-500 text-xs block mb-1">Description</span>
                <p className="text-gray-900 text-sm p-2 bg-gray-50 rounded border border-gray-100 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {viewLogDetail.description || "—"}
                </p>
              </div>
              {viewLogDetail.userAgent && (
                <div className="mt-2">
                  <span className="text-gray-500 text-xs block mb-0.5">User agent</span>
                  <p className="text-gray-700 text-xs break-all line-clamp-2">{viewLogDetail.userAgent}</p>
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewLogDetail(null)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate profile modal */}
      {(candidateProfile !== null || candidateProfileLoading) && (
        <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Candidate Profile</h3>
              <button
                type="button"
                onClick={() => { setCandidateProfile(null); setCandidateProfileLoading(false); }}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {candidateProfileLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : candidateProfile ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Name</span>
                    <p className="text-gray-900 font-medium">{candidateProfile.fullName}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Email</span>
                    <p className="text-gray-900">{candidateProfile.email}</p>
                  </div>
                  {candidateProfile.phone && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Phone</span>
                      <p className="text-gray-900">{candidateProfile.phone}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Cohorts</span>
                    {candidateProfile.enrollments?.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-sm text-gray-700">
                        {candidateProfile.enrollments.map((e) => (
                          <li key={e.id} className="flex flex-wrap gap-x-2 items-baseline">
                            <span className="font-medium">{e.cohortName}</span>
                            {e.organisation && <span className="text-gray-500">({e.organisation})</span>}
                            <span className="text-gray-500 text-xs">{e.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No enrollments</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Candidate not found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User profile modal */}
      {(profileUser !== null || profileLoading) && (
        <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
              <button
                type="button"
                onClick={() => { setProfileUser(null); setProfileLoading(false); }}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {profileLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : profileUser ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Name</span>
                    <p className="text-gray-900 font-medium">
                      {profileUser.fullName ||
                        [profileUser.firstName, profileUser.middleName, profileUser.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Email</span>
                    <p className="text-gray-900">{profileUser.email}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Role</span>
                    <p>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleColor(
                          profileUser.role
                        )}`}
                      >
                        {profileUser.role}
                      </span>
                    </p>
                  </div>
                  {profileUser.organisation && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">Organisation</span>
                      <p className="text-gray-900">{profileUser.organisation}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Last Login</span>
                    <p className="text-gray-900">
                      {profileUser.lastLoginAt
                        ? new Date(profileUser.lastLoginAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">User not found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
