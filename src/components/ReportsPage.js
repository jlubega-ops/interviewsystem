"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  BarChart3,
  TrendingUp,
  BookOpen,
  Send,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Filter,
} from "lucide-react";
import NavigationHeader from "./NavigationHeader";
import { getSubmissionReasonLabel } from "../lib/submissionReasons";

const REPORT_TYPES = [
  { id: "completion", label: "Completion & Attempts", icon: BarChart3, description: "Attempt counts, completion rate, by submission reason" },
  { id: "performance", label: "Performance / Scores", icon: TrendingUp, description: "Average scores, min/max, top candidates by cohort/interview" },
  { id: "cohorts", label: "Cohort Summary", icon: BookOpen, description: "Cohorts with enrollments, attempts and completion rate" },
  { id: "submissions", label: "Submission Outcomes", icon: Send, description: "Breakdown of how attempts ended (time up, submitted, etc.)" },
];

const INTERVIEW_TYPES = [
  { value: "", label: "All types" },
  { value: "APTITUDE", label: "Aptitude" },
  { value: "TYPING", label: "Typing" },
  { value: "ORAL", label: "Oral" },
];

export default function ReportsPage() {
  const [report, setReport] = useState("completion");
  const [cohortId, setCohortId] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("report", report);
      if (cohortId) params.set("cohortId", cohortId);
      if (interviewType) params.set("interviewType", interviewType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (organisation) params.set("organisation", organisation);
      const res = await fetch(`/api/reports?${params}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          setError("You do not have permission to view reports.");
          return;
        }
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load report");
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [report, cohortId, interviewType, from, to, organisation]);

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
        setError("Only admins can view reports.");
        setLoading(false);
        return;
      }
    } catch {
      window.location.href = "/admin/login";
    }
  };

  useEffect(() => {
    verifyAndFetch();
  }, []);

  useEffect(() => {
    if (report && (report === "cohorts" || report === "completion" || report === "performance" || report === "submissions")) {
      fetchReport();
    }
  }, [report, cohortId, interviewType, from, to, organisation, fetchReport]);

  const showCohortFilter = report !== "cohorts";
  const showInterviewTypeFilter = report === "completion" || report === "performance" || report === "submissions";
  const showOrganisationFilter = true;
  const cohortOptions = data?.cohortOptions ?? [];
  const organisationOptions = data?.organisationOptions ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Reports"
        subtitle="Completion, performance, cohorts and submission analytics"
        icon="PieChart"
        showBackButton
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Reports", href: "/admin/reports" },
        ]}
      />

      <main className="flex-1 min-h-0 overflow-auto max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Report type tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setReport(r.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                  report === r.id
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-gray-200 bg-white text-gray-700 hover:border-violet-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${report === r.id ? "text-violet-600" : "text-gray-500"}`} />
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            {showCohortFilter && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cohort</label>
                <select
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All cohorts</option>
                  {cohortOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {showInterviewTypeFilter && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Interview type</label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
            {showOrganisationFilter && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Organisation</label>
                {report === "cohorts" && organisationOptions.length > 0 ? (
                  <select
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[140px]"
                  >
                    <option value="">All</option>
                    {organisationOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    placeholder="Filter by organisation"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
                  />
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button
              type="button"
              onClick={() => fetchReport()}
              disabled={loading}
              className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && report === "completion" && (
          <CompletionReportView data={data} />
        )}
        {!loading && data && report === "performance" && (
          <PerformanceReportView data={data} />
        )}
        {!loading && data && report === "cohorts" && (
          <CohortReportView data={data} />
        )}
        {!loading && data && report === "submissions" && (
          <SubmissionsReportView data={data} />
        )}

        {!loading && !data && !error && (
          <div className="text-center py-12 text-gray-500">Select a report and apply filters.</div>
        )}
      </main>
    </div>
  );
}

function CompletionReportView({ data }) {
  const s = data.summary || {};
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <SummaryCard label="Total attempts" value={s.total ?? 0} />
        <SummaryCard label="Completed" value={s.completed ?? 0} />
        <SummaryCard label="In progress" value={s.inProgress ?? 0} />
        <SummaryCard label="Abandoned" value={s.abandoned ?? 0} />
        <SummaryCard label="Completion rate" value={`${s.completionRate ?? 0}%`} />
      </div>
      {(data.bySubmissionReason?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">By submission reason</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Reason</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.bySubmissionReason.map(({ reason, count }) => (
                <tr key={reason} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{getSubmissionReasonLabel(reason)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.byInterviewType?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">By interview type</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Type</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.byInterviewType.map(({ type, count }) => (
                <tr key={type} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{type}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PerformanceReportView({ data }) {
  const s = data.summary || {};
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <SummaryCard label="Completed attempts" value={s.attemptCount ?? 0} />
        <SummaryCard label="Avg score" value={s.avgScore ?? 0} />
        <SummaryCard label="Avg %" value={`${s.avgPercent ?? 0}%`} />
        <SummaryCard label="Min score" value={s.minScore ?? 0} />
        <SummaryCard label="Max score" value={s.maxScore ?? 0} />
      </div>
      {(data.byInterviewType?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">By interview type</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Type</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Attempts</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Avg score</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Avg %</th>
              </tr>
            </thead>
            <tbody>
              {data.byInterviewType.map(({ type, count, avgScore, avgPercent }) => (
                <tr key={type} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{type}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{count}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{avgScore}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{avgPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.topCandidates?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">Top 20 by score</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Candidate</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Cohort</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Type</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">Score</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.topCandidates.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-900">{c.candidateName} {c.candidateEmail && `(${c.candidateEmail})`}</td>
                    <td className="px-4 py-2 text-gray-600">{c.cohortName || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{c.interviewType || "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.score}/{c.totalQuestions}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CohortReportView({ data }) {
  const rows = data.rows || [];
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">Cohort summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Cohort</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Organisation</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Enrollments</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Attempts</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Completed</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Rate</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Open – Close</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-gray-600">{r.organisation || "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.enrollmentCount}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.attemptsTotal}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.attemptsCompleted}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.completionRate}%</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {r.openTime ? new Date(r.openTime).toLocaleDateString() : "—"} – {r.closeTime ? new Date(r.closeTime).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="p-8 text-center text-gray-500">No cohorts match the filters.</div>}
      </div>
    </div>
  );
}

function SubmissionsReportView({ data }) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600">Total completed attempts: <strong>{data.totalCompleted ?? 0}</strong></div>
      {(data.byReason?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">By outcome reason</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Reason</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.byReason.map(({ reason, count }) => (
                <tr key={reason} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{getSubmissionReasonLabel(reason)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.byReasonAndType?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 font-medium text-gray-900">By reason and interview type</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Reason</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Interview type</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.byReasonAndType.map(({ reason, type, count }, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-900">{getSubmissionReasonLabel(reason)}</td>
                  <td className="px-4 py-2 text-gray-600">{type}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
