"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, LogIn } from "lucide-react";
import { useMessages } from "./MessageSystem";
import AccessFormBrand from "./AccessFormBrand";
import AuthSplitLayout from "./AuthSplitLayout";

function CandidateAccessInner() {
  const [accessKey, setAccessKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const idleLogout = searchParams.get("idle") === "1";
  const { showSuccess, showError } = useMessages();
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/verify", { method: "GET", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setAdminUser(data.user);
      })
      .catch(() => {});
  }, []);

  const checkExistingSession = useCallback(async () => {
    try {
      const candidateData = sessionStorage.getItem("candidate_data");
      if (!candidateData) {
        setIsCheckingSession(false);
        return;
      }

      const candidate = JSON.parse(candidateData);

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
        router.push("/candidate/welcome");
      } else {
        sessionStorage.removeItem("candidate_data");
        sessionStorage.removeItem("current_interview");
        setIsCheckingSession(false);
      }
    } catch (error) {
      console.error("Error checking existing session:", error);
      sessionStorage.removeItem("candidate_data");
      sessionStorage.removeItem("current_interview");
      setIsCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const handleInputChange = (e) => {
    setAccessKey(e.target.value.toUpperCase());
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

  return (
    <AuthSplitLayout
      headerRight={
        <Link
          href={adminUser ? "/admin/dashboard" : "/?view=admin"}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 bg-white/90 hover:bg-white border border-white/70 shadow-md px-3.5 py-2 rounded-lg backdrop-blur-sm transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {adminUser ? "Dashboard" : "Admin login"}
        </Link>
      }
    >
      <AccessFormBrand
        showLogo={false}
        title="Start your interview"
        subtitle="Enter the access key you were given to begin."
      />
      {idleLogout ? (
        <div className="mb-6 p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 text-sm font-medium">
          You were logged out due to inactivity. Enter your access key to
          continue.
        </div>
      ) : null}

      {isCheckingSession ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking session...</p>
        </div>
      ) : (
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
              className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider placeholder-gray-500"
              autoComplete="off"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !accessKey.trim()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            <span>{isLoading ? "Verifying..." : "Start Interview"}</span>
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
}

export default function CandidateAccess() {
  return (
    <Suspense fallback={null}>
      <CandidateAccessInner />
    </Suspense>
  );
}
