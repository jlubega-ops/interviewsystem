"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useMessages } from "./MessageSystem";

const ALL_SCOPE_OPTIONS = [
  { value: "ALL_USERS", label: "All users (admin & examiners)" },
  { value: "ADMIN_ONLY", label: "Admin only" },
  { value: "PRIVATE", label: "Private (only me)" },
];

// Examiners may only use All users or Private (not Admin only)
const EXAMINER_SCOPE_OPTIONS = ALL_SCOPE_OPTIONS.filter((o) => o.value !== "ADMIN_ONLY");

export default function AddQuestionBankDialog({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [scope, setScope] = useState("ALL_USERS");
  const [isLoading, setIsLoading] = useState(false);
  const [scopeOptions, setScopeOptions] = useState(EXAMINER_SCOPE_OPTIONS);
  const { showSuccess, showError } = useMessages();

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const role = d?.user?.role;
        setScopeOptions(role === "ADMIN" || role === "SUPERADMIN" ? ALL_SCOPE_OPTIONS : EXAMINER_SCOPE_OPTIONS);
      })
      .catch(() => setScopeOptions(EXAMINER_SCOPE_OPTIONS));
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showError("Question bank name is required");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/question-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), isActive, scope }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || "Question bank created");
        setName("");
        setIsActive(true);
        setScope("ALL_USERS");
        onSuccess?.(data.questionBank);
        onClose();
      } else {
        showError(data.error || "Failed to create question bank");
      }
    } catch (err) {
      showError("Failed to create question bank");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add Question Bank</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Math Aptitude 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={scopeOptions.some((o) => o.value === scope) ? scope : scopeOptions[0]?.value ?? "ALL_USERS"}
                onChange={(e) => setScope(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                {scopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Who can access this question bank</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
