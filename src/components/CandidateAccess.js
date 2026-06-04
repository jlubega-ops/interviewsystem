"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useMessages, MessageDisplay } from "./MessageSystem";
import AccessFormBrand from "./AccessFormBrand";

export default function CandidateAccess() {
  const [accessKey, setAccessKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const idleLogout = searchParams.get("idle") === "1";
  const { showSuccess, showError } = useMessages();

  const checkExistingSession = useCallback(async () => {
    try {
      const candidateData = sessionStorage.getItem("candidate_data");
      if (!candidateData) {
        setIsCheckingSession(false);
        return;
      }

      const candidate = JSON.parse(candidateData);

      // Verify session is still valid
      const response = await fetch("/api/candidate/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: candidate.id,
          accessKey: candidate.accessKey,
        }),
      });

      if (response.ok) {
        // Session is valid, redirect to welcome page
        router.push("/candidate/welcome");
      } else {
        // Session is invalid, clear data and allow login
        sessionStorage.removeItem("candidate_data");
        sessionStorage.removeItem("current_interview");
        setIsCheckingSession(false);
      }
    } catch (error) {
      console.error("Error checking existing session:", error);
      // Clear any invalid data
      sessionStorage.removeItem("candidate_data");
      sessionStorage.removeItem("current_interview");
      setIsCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    // Check if candidate already has an active session
    checkExistingSession();
  }, [checkExistingSession]);

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setAccessKey(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessKey.trim()) {
      showError("Please enter your access key");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/candidate/verify-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess("Access key verified successfully!");
        // Store access key in session storage for security
        sessionStorage.setItem("candidate_access_key", accessKey.trim());
        sessionStorage.setItem(
          "candidate_data",
          JSON.stringify(result.candidate)
        );
        router.push("/candidate/welcome");
      } else {
        showError(result.error || "Invalid access key");
      }
    } catch (error) {
      console.error("Error verifying access key:", error);
      showError("Failed to verify access key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
      <main className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md">
        <MessageDisplay />
        {idleLogout && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
            You were logged out due to inactivity. Please enter your access key to sign in again.
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8">
          <AccessFormBrand
            title="Enter Access Key"
            subtitle="Enter your access key to start the interview"
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="accessKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Access Key
              </label>
              <input
                id="accessKey"
                type="text"
                value={accessKey}
                onChange={handleInputChange}
                placeholder="Enter your access key"
                className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider placeholder-gray-500"
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Your access key will be automatically converted to uppercase
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !accessKey.trim()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <span>{isLoading ? "Verifying..." : "Start Interview"}</span>
            </button>
          </form>
        </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/60 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600">
            <p className="text-sm">
              <span suppressHydrationWarning>
                &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
