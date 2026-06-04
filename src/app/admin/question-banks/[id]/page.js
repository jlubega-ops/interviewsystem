import Link from "next/link";
import { ArrowLeft, Home, FileText } from "lucide-react";
import QuestionBankDetails from "@/components/QuestionBankDetails";
import NavigationHeader from "@/components/NavigationHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuestionBankPage({ params }) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link href="/admin/question-banks" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Question Banks</span>
              </Link>
              <Link href="/admin/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Question Bank</span>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <QuestionBankDetails questionBankId={id} />
      </main>
    </div>
  );
}
