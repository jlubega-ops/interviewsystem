"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle, Loader2, FolderOpen } from "lucide-react";
import { useMessages } from "./MessageSystem";
import AddQuestionBankDialog from "./AddQuestionBankDialog";
import ConfirmationDialog from "./ConfirmationDialog";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager, onTableRowClick } from "./ClientTableChrome";

const SCOPE_LABELS = {
  ALL_USERS: "All users",
  ADMIN_ONLY: "Admin only",
  PRIVATE: "Private",
};

export default function QuestionBanksList() {
  const router = useRouter();
  const [banks, setBanks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showSuccess, showError } = useMessages();
  const table = useClientTable(banks, {
    pageSize: 10,
    searchText: (bank) =>
      [bank.name, bank.scope, bank.creator?.fullName, String(bank.questionCount ?? 0)].join(" "),
  });

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/question-banks", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setBanks(data.questionBanks || []);
      else setError(data.error || "Failed to load question banks");
    } catch (err) {
      setError("Failed to load question banks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleAddSuccess = (newBank) => {
    if (newBank) setBanks((prev) => [newBank, ...prev]);
    else fetchBanks();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/question-banks/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message);
        setBanks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        showError(data.error || "Failed to delete");
      }
    } catch (err) {
      showError("Failed to delete question bank");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading question banks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchBanks}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <TableSearch
            query={table.query}
            setQuery={table.setQuery}
            placeholder="Search question banks..."
            filteredCount={table.filteredCount}
            totalCount={table.totalCount}
          />
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add question bank
          </button>
        </div>
        {banks.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No question banks yet.</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add question bank
            </button>
          </div>
        ) : table.filteredCount === 0 ? (
          <p className="p-6 text-sm text-gray-500">No question banks match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Questions</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Scope</th>
                  <th className="px-4 py-2 hidden md:table-cell">Created by</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.pageRows.map((bank) => (
                  <tr
                    key={bank.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={onTableRowClick(() =>
                      router.push(`/admin/question-banks/${bank.id}`)
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {bank.name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{bank.questionCount ?? 0}</td>
                    <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">
                      {SCOPE_LABELS[bank.scope] || bank.scope}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">
                      {bank.creator?.fullName || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(bank)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
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
      </div>

      <AddQuestionBankDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleAddSuccess}
      />

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete question bank"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? All questions in this bank will be removed.` : ""}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteLoading}
      />
    </>
  );
}
