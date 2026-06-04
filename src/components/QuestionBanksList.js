"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Plus, AlertCircle, Loader2, FolderOpen } from "lucide-react";
import { useMessages } from "./MessageSystem";
import AddQuestionBankDialog from "./AddQuestionBankDialog";
import ConfirmationDialog from "./ConfirmationDialog";

const SCOPE_LABELS = {
  ALL_USERS: "All users",
  ADMIN_ONLY: "Admin only",
  PRIVATE: "Private",
};

export default function QuestionBanksList() {
  const [banks, setBanks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showSuccess, showError } = useMessages();

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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Question Banks</h2>
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Question Bank
            </button>
          </div>
        </div>
        <div className="p-6">
          {banks.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No question banks yet</h3>
              <p className="text-gray-600 mb-6">Create a question bank to store and reuse questions across interviews.</p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Question Bank
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all"
                >
                  <Link href={`/admin/question-banks/${bank.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">{bank.name}</h3>
                        <p className="text-sm text-gray-500">
                          {bank.questionCount ?? 0} questions · {SCOPE_LABELS[bank.scope] || bank.scope}
                          {bank.creator?.fullName ? ` · ${bank.creator.fullName}` : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/admin/question-banks/${bank.id}`}
                      className="px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(bank)}
                      className="px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
