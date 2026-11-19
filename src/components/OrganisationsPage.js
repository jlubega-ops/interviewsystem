"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import NavigationHeader from "./NavigationHeader";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager } from "./ClientTableChrome";

const CONFIRM_WORD = "DELETE";

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const table = useClientTable(orgs, {
    pageSize: 10,
    searchText: (org) =>
      [org.name, org.description, String(org.userCount), String(org.cohortCount)].join(" "),
  });

  const fetchOrgs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/organisations", { credentials: "include" });
      if (res.status === 403) {
        window.location.href = "/admin/dashboard";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load organisations");
      }
      const data = await res.json();
      setOrgs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const resetForm = () => {
    setForm({ name: "", description: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.name.trim()) {
      setError("Organisation name is required");
      return;
    }
    setIsSaving(true);
    try {
      const url = editingId
        ? `/api/organisations/${editingId}`
        : "/api/organisations";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save organisation");
      }
      setSuccess(editingId ? "Organisation updated." : "Organisation created.");
      resetForm();
      await fetchOrgs();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (confirmInput.trim() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} in capital letters to confirm.`);
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/organisations/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmWord: confirmInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete organisation");
      }
      setSuccess(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      setConfirmInput("");
      await fetchOrgs();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Organisations"
        subtitle="Create and manage organisations used across users and cohorts"
        icon="Building2"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Organisations", href: "/admin/organisations" },
        ]}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {error ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        ) : null}
        {success ? (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 mb-8 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {editingId ? "Edit organisation" : "Add organisation"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="e.g. MUBS EIIC"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <TableSearch
              query={table.query}
              setQuery={table.setQuery}
              placeholder="Search organisations..."
              filteredCount={table.filteredCount}
              totalCount={table.totalCount}
            />
          </div>
          {isLoading ? (
            <p className="p-6 text-gray-500">Loading organisations...</p>
          ) : orgs.length === 0 ? (
            <p className="p-6 text-gray-500">No organisations yet.</p>
          ) : table.filteredCount === 0 ? (
            <p className="p-6 text-sm text-gray-500">No organisations match your search.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Cohorts</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {table.pageRows.map((org) => (
                  <tr key={org.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {org.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {org.description || "—"}
                    </td>
                    <td className="px-4 py-3">{org.userCount}</td>
                    <td className="px-4 py-3">{org.cohortCount}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(org.id);
                          setForm({
                            name: org.name,
                            description: org.description || "",
                          });
                        }}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={(org.userCount || 0) > 0 || (org.cohortCount || 0) > 0}
                        onClick={() => {
                          setDeleteTarget(org);
                          setConfirmInput("");
                        }}
                        title={
                          (org.userCount || 0) > 0 || (org.cohortCount || 0) > 0
                            ? "Cannot delete while users or cohorts use this organisation"
                            : "Delete"
                        }
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <TablePager
            page={table.page}
            setPage={table.setPage}
            totalPages={table.totalPages}
            filteredCount={table.filteredCount}
            pageSize={table.pageSize}
          />
        </div>
      </main>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleDelete}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-2 text-red-700 mb-3">
              <Building2 className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Delete organisation</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>{deleteTarget.name}</strong>.
              Organisations still assigned to users or cohorts cannot be deleted.
              Type{" "}
              <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to
              confirm.
            </p>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono uppercase mb-4 text-gray-900"
              placeholder={CONFIRM_WORD}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmInput("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting || confirmInput.trim() !== CONFIRM_WORD}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
