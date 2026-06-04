"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";

export default function DeleteCohortModal({
  isOpen,
  onClose,
  cohortName,
  cohortId,
  onDeleted,
}) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const handleClose = () => {
    if (!isSubmitting) {
      setConfirmName("");
      setError("");
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = confirmName.trim();
    if (!trimmed) {
      setError("Please enter the cohort name to confirm.");
      return;
    }
    if (trimmed !== cohortName) {
      setError(`Name does not match. Type exactly: "${cohortName}"`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        setConfirmName("");
        handleClose();
        onDeleted?.();
      } else {
        setError(data.error || "Failed to delete cohort.");
      }
    } catch (err) {
      setError("Failed to delete cohort. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 bg-gray-600/30 overflow-y-auto h-full w-full flex justify-center items-center z-[9999] p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900">
              Delete cohort
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-gray-700 font-medium">
            You are about to permanently delete the cohort{" "}
            <strong>&quot;{cohortName}&quot;</strong>. This action cannot be undone.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-2">The following will be permanently deleted:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All interviews linked to this cohort</li>
              <li>All candidate enrollments and access keys for this cohort</li>
              <li>All examiner assignments to this cohort</li>
              <li>All candidate attempts (and answers) for this cohort</li>
            </ul>
            <p className="mt-2 text-amber-800">
              Candidates may still belong to other cohorts; only data for this cohort is removed.
            </p>
          </div>
          <p className="text-gray-600 text-sm">
            To confirm, type the exact cohort name below:{" "}
            <strong>&quot;{cohortName}&quot;</strong>
          </p>

          <div>
            <label
              htmlFor="delete-cohort-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cohort name
            </label>
            <input
              id="delete-cohort-name"
              type="text"
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value);
                setError("");
              }}
              placeholder={`Type "${cohortName}" to confirm`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 bg-white placeholder-gray-500"
              autoComplete="off"
              disabled={isSubmitting}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || confirmName.trim() !== cohortName}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete cohort</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
