"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import LoginForm from "../../../components/LoginForm";
import AccessFormBrand from "../../../components/AccessFormBrand";
import BuildingBackgroundPage from "../../../components/BuildingBackgroundPage";

export default function AdminLogin() {
  const searchParams = useSearchParams();
  const [expiredMessage, setExpiredMessage] = useState("");

  useEffect(() => {
    const expired = searchParams.get("expired");
    const error = searchParams.get("error");
    const idle = searchParams.get("idle");

    if (idle === "1" || (error && decodeURIComponent(error || "").toLowerCase().includes("inactivity"))) {
      setExpiredMessage("You were logged out after 10 minutes of inactivity. Please log in again.");
    } else if (expired === "true" || error === "Session expired" || error === "Invalid session") {
      setExpiredMessage("Your session has expired. Please log in again.");
    }
  }, [searchParams]);

  return (
    <BuildingBackgroundPage overlayClassName="bg-white/50 backdrop-blur-[2px]">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/70 backdrop-blur-md border-b border-white/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white/80 px-3 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Image
                src="/images/logo.png"
                alt="MUBS EIIC Logo"
                width={36}
                height={36}
                className="rounded-lg shadow-sm"
              />
              <span className="text-lg font-bold text-gray-900">MUBS EIIC</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full max-w-md">
          <div className="bg-white/85 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-8">
            <AccessFormBrand
              title="Admin Login"
              subtitle="Login as admin or examiner to manage the system"
            />

            {expiredMessage && (
              <div className="mb-6 p-4 bg-amber-50/95 border border-amber-200 rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <p className="text-amber-800 font-medium text-sm">{expiredMessage}</p>
                </div>
              </div>
            )}

            <LoginForm />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/60 backdrop-blur-md border-t border-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="text-center text-gray-700">
            <p className="text-sm" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </BuildingBackgroundPage>
  );
}
