"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload, Download, X, Loader2, Edit3, Trash2 } from "lucide-react";
import { useMessages } from "./MessageSystem";
import QuestionBankQuestionCards from "./QuestionBankQuestionCards";
import BulkQuestionUploadForBank from "./BulkQuestionUploadForBank";
import EditQuestionBankDialog from "./EditQuestionBankDialog";
import ConfirmationDialog from "./ConfirmationDialog";

const SCOPE_LABELS = { ALL_USERS: "All users", ADMIN_ONLY: "Admin only", PRIVATE: "Private" };

export default function QuestionBankDetails({ questionBankId }) {
  const router = useRouter();
  const [bank, setBank] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showError, showSuccess } = useMessages();

  const fetchBank = useCallback(async () => {
    if (!questionBankId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/question-banks/${questionBankId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setBank(data.questionBank);
      else showError(data.error || "Failed to load question bank");
    } catch (err) {
      showError("Failed to load question bank");
    } finally {
      setIsLoading(false);
    }
  }, [questionBankId]);

  useEffect(() => {
    fetchBank();
  }, [questionBankId, fetchBank]);

  const handleDownload = () => {
    window.open(`/api/question-banks/${questionBankId}/questions/download`, "_blank");
  };

  const handleEditSuccess = (updatedBank) => {
    setBank(updatedBank);
    setShowEditDialog(false);
  };

  const handleDeleteConfirm = async () => {
    if (!questionBankId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/question-banks/${questionBankId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || "Question bank deleted");
        router.push("/admin/question-banks");
      } else {
        showError(data.error || "Failed to delete question bank");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      showError("Failed to delete question bank");
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading question bank...</span>
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="bg-white p-8 rounded-lg shadow">
        <p className="text-gray-600">Question bank not found.</p>
        <Link href="/admin/question-banks" className="text-blue-600 hover:underline mt-2 inline-block">Back to Question Banks</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{bank.name}</h1>
              <p className="text-sm text-gray-500">
                {bank.questionCount ?? 0} questions · {SCOPE_LABELS[bank.scope] || bank.scope}
                {bank.creator?.fullName ? ` · ${bank.creator.fullName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <EditQuestionBankDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        bank={bank}
        onSuccess={handleEditSuccess}
      />

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete question bank"
        message={bank ? `Are you sure you want to delete "${bank.name}"? All questions in this bank will be removed.` : ""}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteLoading}
      />

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
          <div className="flex items-center gap-2">
            {showUpload ? (
              <button
                onClick={() => setShowUpload(false)}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
                Back to list
              </button>
            ) : (
              <>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Download className="w-4 h-4" />
                  Download questions
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Upload className="w-4 h-4" />
                  Upload questions
                </button>
              </>
            )}
          </div>
        </div>
        <div className="p-6">
          {showUpload ? (
            <BulkQuestionUploadForBank questionBankId={questionBankId} onUploadComplete={() => { setShowUpload(false); fetchBank(); }} />
          ) : (
            <QuestionBankQuestionCards questionBankId={questionBankId} />
          )}
        </div>
      </div>
    </div>
  );
}
