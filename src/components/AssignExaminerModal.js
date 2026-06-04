"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UserPlus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Ban,
  Mail,
  User,
} from "lucide-react";

const TABS = [
  { id: "create", label: "Create new", icon: UserPlus },
  { id: "search", label: "Search existing", icon: Search },
];

export default function AssignExaminerModal({
  isOpen,
  onClose,
  cohortId,
  onAssigned,
}) {
  const [activeTab, setActiveTab] = useState("create");
  const [createForm, setCreateForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    organisation: "",
    contact: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}&cohortId=${cohortId}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok) setSearchResults(data.data || []);
      else setSearchResults([]);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, cohortId]);

  useEffect(() => {
    const t = setTimeout(runSearch, 300);
    return () => clearTimeout(t);
  }, [runSearch]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!createForm.firstName?.trim() || !createForm.lastName?.trim() || !createForm.email?.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/examiners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          createNew: true,
          firstName: createForm.firstName.trim(),
          middleName: createForm.middleName?.trim() || undefined,
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim(),
          organisation: createForm.organisation?.trim() || undefined,
          contact: createForm.contact?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create and assign examiner.");
        return;
      }
      setSuccess("Examiner created and assigned. Activation email sent.");
      setCreateForm({ firstName: "", middleName: "", lastName: "", email: "", organisation: "", contact: "" });
      if (onAssigned) onAssigned();
    } catch {
      setError("Failed to create and assign examiner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignExisting = async (userId) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/examiners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to assign examiner.");
        return;
      }
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, alreadyAssignedToThisCohort: true } : u))
      );
      if (onAssigned) onAssigned();
    } catch {
      setError("Failed to assign examiner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assign examiner</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200 flex">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setError(null); setSuccess(null); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {activeTab === "create" && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">Create a new user with Examiner role and assign them to this cohort. They will receive an activation email.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                  <input
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="First name"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Middle name</label>
                  <input
                    type="text"
                    value={createForm.middleName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, middleName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                  <input
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Last name"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organisation</label>
                  <input
                    type="text"
                    value={createForm.organisation}
                    onChange={(e) => setCreateForm((p) => ({ ...p, organisation: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact (phone)</label>
                  <input
                    type="tel"
                    value={createForm.contact}
                    onChange={(e) => setCreateForm((p) => ({ ...p, contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Create & assign
                </button>
              </div>
            </form>
          )}

          {activeTab === "search" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search by email or name</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type at least 2 characters..."
                  disabled={isSubmitting}
                />
              </div>
              {isSearching && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
                  <p className="text-sm text-gray-500">No examiners found.</p>
                )}
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {u.email}
                        </p>
                        {u.organisation && <p className="text-xs text-gray-400">{u.organisation}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.isSuspended && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          <Ban className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                      {u.alreadyAssignedToThisCohort && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          <UserCheck className="w-3 h-3" />
                          Already assigned
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAssignExisting(u.id)}
                        disabled={u.isSuspended || u.alreadyAssignedToThisCohort || isSubmitting}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
