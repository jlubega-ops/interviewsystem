import CohortsList from "../../../components/CohortsList";
import NavigationHeader from "../../../components/NavigationHeader";
import CohortStatsCards from "../../../components/CohortStatsCards";

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
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <CohortStatsCards />

        {/* Cohorts List */}
        <CohortsList />
      </main>
    </div>
  );
}
