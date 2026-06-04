"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import LoginForm from "../../../components/LoginForm";

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Image
                src="/images/logo.png"
                alt="MUBS EIIC Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-gray-900">MUBS EIIC</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Admin Login
            </h1>
            <p className="text-gray-600 text-sm">
              Login as admin to manage the system
            </p>
          </div>

          {/* Expired Session Message */}
          {expiredMessage && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <p className="text-amber-800 font-medium">{expiredMessage}</p>
              </div>
            </div>
          )}

          {/* Login Form Component */}
          <LoginForm />
        </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/60 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="text-center text-gray-600">
            <p className="text-sm" suppressHydrationWarning>
              &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
