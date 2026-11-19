import Link from "next/link";
import { ArrowLeft, Home, FolderOpen } from "lucide-react";
import QuestionBanksList from "@/components/QuestionBanksList";
import NavigationHeader from "@/components/NavigationHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function QuestionBanksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Question Banks"
        subtitle="Manage reusable question banks for aptitude interviews"
        icon="FolderOpen"
        showBackButton
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Question Banks", href: "/admin/question-banks" },
        ]}
        showLogout
      />
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <QuestionBanksList />
      </main>
    </div>
  );
}
