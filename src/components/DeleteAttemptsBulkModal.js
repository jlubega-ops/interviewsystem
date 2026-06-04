"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";

const CONFIRM_WORD = "DELETE";

export default function DeleteAttemptsBulkModal({
  isOpen,
  onClose,
  attemptIds = [],
  interviewId,
  onDeleted,
}) {
  const [confirmInput, setConfirmInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isOpen) {
      setConfirmInput("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const count = attemptIds.length;
  const canConfirm = confirmInput.trim() === CONFIRM_WORD;

  const handleClose = () => {
    if (!isSubmitting) {
      setConfirmInput("");
      setError("");
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canConfirm) {
      setError(`Type ${CONFIRM_WORD} in capital letters to confirm.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/interviews/${interviewId}/attempts/bulk-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            attemptIds,
            confirmWord: confirmInput.trim(),
          }),
        }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmInput("");
        handleClose();
        onDeleted?.();
      } else {
        setError(data.error || "Failed to delete attempts.");
      }
    } catch (err) {
      setError("Failed to delete attempts. Please try again.");
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
              Delete selected attempts
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
            You are about to permanently delete <strong>{count}</strong> attempt{count !== 1 ? "s" : ""}. This cannot be undone.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            All selected attempts and their answers will be removed. This action cannot be undone.
          </div>
          <p className="text-gray-700 text-sm">
            To confirm, type <strong className="font-mono">{CONFIRM_WORD}</strong> in the box below (all capital letters).
          </p>

          <div>
            <label htmlFor="bulk-delete-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="bulk-delete-confirm"
              type="text"
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value);
                setError("");
              }}
              placeholder={CONFIRM_WORD}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 bg-white font-mono placeholder-gray-400 uppercase"
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
              disabled={!canConfirm || isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete {count} attempt{count !== 1 ? "s" : ""}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
