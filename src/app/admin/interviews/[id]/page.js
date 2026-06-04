import Link from "next/link";
import { ArrowLeft, FileText, Home } from "lucide-react";
import InterviewDetails from "@/components/InterviewDetails";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering - this page should never be statically generated
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InterviewDetailsPage({ params }) {
  const { id } = await params;

  // Get cohort for this interview so Back goes to the cohort page
  const cohortLink = await prisma.cohortInterview.findFirst({
    where: { interviewId: id },
    select: { cohortId: true },
  });
  const cohortId = cohortLink?.cohortId;
  const backHref = cohortId ? `/admin/cohorts/${cohortId}` : "/admin/cohorts";
  const backLabel = cohortId ? "Back to Cohort" : "Back to Cohorts";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link
                href={backHref}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">{backLabel}</span>
              </Link>
              <Link
                href="/admin/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                Interview Details
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <InterviewDetails interviewId={id} />
      </main>
    </div>
  );
}
