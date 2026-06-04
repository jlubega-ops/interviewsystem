"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Eye,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";
import { sanitizeHtml } from "../lib/sanitize";
import NavigationHeader from "./NavigationHeader";
import DeleteCohortModal from "./DeleteCohortModal";
import { useServerTime } from "../hooks/useServerTime";

export default function CohortsList() {
  const { serverNow } = useServerTime();
  const [cohorts, setCohorts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const { showSuccess, showError } = useMessages();

  useEffect(() => {
    fetchCohorts();
  }, []);

  useEffect(() => {
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setCurrentUser(d.user))
      .catch(() => {});
  }, []);

  const fetchCohorts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/cohorts");
      const data = await response.json();

      if (response.ok) {
        setCohorts(data.cohorts || []);
      } else {
        setError(data.error || "Failed to fetch cohorts");
      }
    } catch (err) {
      setError("Network error while fetching cohorts");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (cohort) => {
    if (!serverNow) return "text-gray-600 bg-gray-100";
    const openTime = new Date(cohort.openTime);
    const closeTime = new Date(cohort.closeTime);
    if (serverNow < openTime) return "text-blue-600 bg-blue-100";
    if (serverNow >= openTime && serverNow <= closeTime) return "text-green-600 bg-green-100";
    return "text-gray-600 bg-gray-100";
  };

  const getStatusText = (cohort) => {
    if (!serverNow) return "—";
    const openTime = new Date(cohort.openTime);
    const closeTime = new Date(cohort.closeTime);
    if (serverNow < openTime) return "Upcoming";
    if (serverNow >= openTime && serverNow <= closeTime) return "Active";
    return "Closed";
  };

  const handleDeleteClick = (cohortId, cohortName) => {
    setDeleteConfirm({ cohortId, cohortName });
  };

  const handleDeleteSuccess = () => {
    if (deleteConfirm) {
      showSuccess("Cohort deleted successfully");
      setCohorts((prev) =>
        prev.filter((cohort) => cohort.id !== deleteConfirm.cohortId)
      );
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading cohorts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error Loading Cohorts
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCohorts}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN";

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdmin ? "All Cohorts" : "My Cohorts"}
          </h2>
          <Link
            href="/admin/cohorts/create"
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Cohort</span>
          </Link>
        </div>
      </div>

      <div className="p-6">
        {cohorts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isAdmin ? "No Cohorts Found" : "No Cohorts Assigned"}
            </h3>
            <p className="text-gray-600 mb-6">
              {isAdmin
                ? "Create your first cohort to get started."
                : "You have not been assigned to any cohorts yet."}
            </p>
            <Link
              href="/admin/cohorts/create"
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create First Cohort</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {cohorts.map((cohort) => (
              <div
                key={cohort.id}
                className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {cohort.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          cohort
                        )}`}
                      >
                        {getStatusText(cohort)}
                      </span>
                    </div>

                    {cohort.description && (
                      <div
                        className="text-gray-600 mb-4 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(cohort.description),
                        }}
                      />
                    )}

                    {cohort.organisation && (
                      <p className="text-sm text-gray-500 mb-2">
                        {cohort.organisation}
                      </p>
                    )}
                    {(cohort.examinerNames?.length > 0) && (
                      <p className="text-sm text-gray-600 mb-2">
                        Examiners:{" "}
                        <span className="font-medium">
                          {cohort.examinerNames.join(", ")}
                        </span>
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Opens:{" "}
                          {new Date(cohort.openTime).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          Closes:{" "}
                          {new Date(cohort.closeTime).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{cohort.enrollmentCount || 0} enrolled</span>
                      </div>
                    </div>

                    {cohort.instructions && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">
                          Instructions
                        </h4>
                        <div
                          className="text-sm text-blue-800 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(cohort.instructions),
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      href={`/admin/cohorts/${cohort.id}`}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <Link
                      href={`/admin/cohorts/${cohort.id}/edit`}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Edit Cohort"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(cohort.id, cohort.name)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Cohort"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteCohortModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        cohortName={deleteConfirm?.cohortName ?? ""}
        cohortId={deleteConfirm?.cohortId}
        onDeleted={handleDeleteSuccess}
      />
    </div>
  );
}
