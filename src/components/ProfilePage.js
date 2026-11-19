"use client";

import { useState, useEffect } from "react";
import { User, Lock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import NavigationHeader from "./NavigationHeader";
import ChangePassword from "./ChangePassword";
import OrganisationSelect from "./OrganisationSelect";

const TABS = [
  { id: "info", label: "Profile info", icon: User },
  { id: "password", label: "Change password", icon: Lock },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("info");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({ organisation: "", contact: "" });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/auth/profile", { credentials: "include" });
      if (!res.ok) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      setUser(data.data);
      setFormData({
        organisation: data.data.organisation || "",
        contact: data.data.phone || "",
      });
    } catch {
      window.location.href = "/admin/login";
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organisation: formData.organisation.trim() || undefined,
          contact: formData.contact.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Profile updated successfully.");
        setUser(data.data);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch {
      setError("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Profile"
        subtitle="View and update your account"
        icon="Home"
        showBackButton
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Profile", href: "/admin/profile" },
        ]}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tab 1: Profile info */}
        {activeTab === "info" && user && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 sm:p-8">
            {user.role === "EXAMINER" && !user.profileCompletedAt && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                Please fill in <strong>Organisation</strong> and <strong>Contact</strong> below and save. This is required before you can use the system (e.g. create cohorts). You will see a reminder until your profile is complete.
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Your information</h2>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full name</label>
                  <p className="text-gray-900 font-medium">{user.fullName || [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || "—"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Role</label>
                  <p className="text-gray-900">{user.role}</p>
                </div>
              </div>

              <div>
                <label htmlFor="organisation" className="block text-sm font-medium text-gray-700 mb-2">
                  Organisation / Institution
                </label>
                <OrganisationSelect
                  value={formData.organisation}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, organisation: e.target.value }))
                  }
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
                  Contact (phone)
                </label>
                <input
                  id="contact"
                  type="tel"
                  value={formData.contact}
                  onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="Phone number"
                  disabled={isSaving}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Change password */}
        {activeTab === "password" && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 sm:p-8">
            <ChangePassword onSuccess={() => setSuccess("Password updated successfully.")} onCancel={null} />
          </div>
        )}
      </main>
    </div>
  );
}
