import Link from "next/link";
import { Users, Plus, Calendar, Clock, BookOpen } from "lucide-react";
import CohortsList from "../../../components/CohortsList";
import NavigationHeader from "../../../components/NavigationHeader";

// Force dynamic rendering - this page should never be statically generated
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CohortsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Navigation Header */}
      <NavigationHeader
        title="Cohort Management"
        subtitle="Create and manage cohorts for your interview sessions"
        icon="BookOpen"
        showBackButton={true}
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Cohorts", href: "/admin/cohorts" },
        ]}
        showLogout={true}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cohort Management
          </h1>
          <p className="text-gray-600">
            Create and manage cohorts for your interview sessions.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Total Cohorts
              </h3>
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
            <p className="text-sm text-gray-600 mt-1">Active cohorts</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Enrolled Candidates
              </h3>
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">156</p>
            <p className="text-sm text-gray-600 mt-1">Total enrollments</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Active Sessions
              </h3>
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">8</p>
            <p className="text-sm text-gray-600 mt-1">Currently running</p>
          </div>
        </div>

        {/* Cohorts List */}
        <CohortsList />
      </main>
    </div>
  );
}
