"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Plus, AlertCircle, Users } from "lucide-react";
import { useMessages } from "./MessageSystem";
import { htmlToPlainText } from "../lib/sanitize";
import DeleteCohortModal from "./DeleteCohortModal";
import { useServerTime } from "../hooks/useServerTime";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager, onTableRowClick } from "./ClientTableChrome";

const searchText = (cohort) =>
  [
    cohort.name,
    htmlToPlainText(cohort.description || ""),
    htmlToPlainText(cohort.instructions || ""),
    cohort.organisation,
    ...(cohort.examinerNames || []),
  ].join(" ");

export default function CohortsList() {
  const router = useRouter();
  const { serverNow } = useServerTime();
  const [cohorts, setCohorts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const { showSuccess } = useMessages();

  const table = useClientTable(cohorts, { searchText, pageSize: 10 });

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
      if (response.ok) setCohorts(data.cohorts || []);
      else setError(data.error || "Failed to fetch cohorts");
    } catch {
      setError("Network error while fetching cohorts");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatus = useCallback(
    (cohort) => {
      if (!serverNow) return { text: "—", className: "bg-gray-100 text-gray-600" };
      const openTime = new Date(cohort.openTime);
      const closeTime = new Date(cohort.closeTime);
      if (serverNow < openTime)
        return { text: "Upcoming", className: "bg-blue-100 text-blue-700" };
      if (serverNow >= openTime && serverNow <= closeTime)
        return { text: "Active", className: "bg-green-100 text-green-700" };
      return { text: "Closed", className: "bg-gray-100 text-gray-600" };
    },
    [serverNow]
  );

  const handleDeleteSuccess = () => {
    if (deleteConfirm) {
      showSuccess("Cohort deleted successfully");
      setCohorts((prev) =>
        prev.filter((cohort) => cohort.id !== deleteConfirm.cohortId)
      );
      setDeleteConfirm(null);
    }
  };

  const isAdmin =
    currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN";

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
        Loading cohorts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-gray-700 mb-3">{error}</p>
        <button
          onClick={fetchCohorts}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <TableSearch
          query={table.query}
          setQuery={table.setQuery}
          placeholder="Search cohorts..."
          filteredCount={table.filteredCount}
          totalCount={table.totalCount}
        />
        <Link
          href="/admin/cohorts/create"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create cohort
        </Link>
      </div>

      {cohorts.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">
            {isAdmin ? "No cohorts yet." : "No cohorts assigned."}
          </p>
          <Link
            href="/admin/cohorts/create"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Create cohort
          </Link>
        </div>
      ) : table.filteredCount === 0 ? (
        <p className="p-6 text-gray-500 text-sm">No cohorts match your search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 hidden md:table-cell">Organisation</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 hidden lg:table-cell">Window</th>
                <th className="px-4 py-2">Enrolled</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.pageRows.map((cohort) => {
                const status = getStatus(cohort);
                return (
                  <tr
                    key={cohort.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={onTableRowClick(() =>
                      router.push(`/admin/cohorts/${cohort.id}`)
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{cohort.name}</p>
                      {cohort.description ? (
                        <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">
                          {htmlToPlainText(cohort.description)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">
                      {cohort.organisation || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                      {new Date(cohort.openTime).toLocaleDateString()} –{" "}
                      {new Date(cohort.closeTime).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {cohort.enrollmentCount || 0}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/cohorts/${cohort.id}/edit`}
                        className="inline-flex p-1.5 text-gray-500 hover:text-green-600"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirm({
                            cohortId: cohort.id,
                            cohortName: cohort.name,
                          })
                        }
                        className="inline-flex p-1.5 text-gray-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TablePager
        page={table.page}
        setPage={table.setPage}
        totalPages={table.totalPages}
        filteredCount={table.filteredCount}
        pageSize={table.pageSize}
      />

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
