"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";

export default function DeleteAttemptModal({
  isOpen,
  onClose,
  attempt,
  interviewId,
  onDeleted,
}) {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const handleClose = () => {
    if (!isSubmitting) {
      setAccessKey("");
      setError("");
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const key = accessKey.trim();
    if (!key) {
      setError("Please enter the candidate's access key.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/interviews/${interviewId}/attempts/${attempt.attemptId}/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessKey: key }),
        }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setAccessKey("");
        handleClose();
        onDeleted?.();
      } else {
        setError(data.error || "Access key does not match. Deletion cancelled.");
      }
    } catch (err) {
      setError("Failed to delete attempt. Please try again.");
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
              Delete candidate attempt
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
            You are about to permanently delete the attempt for{" "}
            <strong>{attempt?.candidateName}</strong>. This cannot be undone.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            This will permanently delete this attempt and all answers recorded for it. The candidate&apos;s other attempts (in this or other cohorts) are not affected.
          </div>
          <p className="text-gray-600 text-sm">
            To confirm, enter the candidate&apos;s <strong>Access Key</strong> below. If it matches, the attempt will be deleted.
          </p>

          <div>
            <label htmlFor="delete-access-key" className="block text-sm font-medium text-gray-700 mb-1">
              Access Key
            </label>
            <input
              id="delete-access-key"
              type="text"
              value={accessKey}
              onChange={(e) => {
                setAccessKey(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="Enter access key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 bg-white font-mono placeholder-gray-500"
              autoComplete="off"
              disabled={isSubmitting}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete attempt</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
