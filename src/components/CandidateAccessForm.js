"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Key, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useMessages, SuccessMessages, ErrorMessages } from "./MessageSystem";

export default function CandidateAccessForm() {
  const [accessKey, setAccessKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!accessKey.trim()) {
        setError("Please enter your access key");
        setIsLoading(false);
        return;
      }

      console.log("Verifying access key:", accessKey);

      // Simulate API call for access key verification
      const response = await fetch("/api/candidate/verify-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Access key verification failed:", result.error);
        setError(result.error || ErrorMessages.ACCESS_DENIED);
        showError(result.error || ErrorMessages.ACCESS_DENIED);
        setIsLoading(false);
        return;
      }

      console.log("Access key verified successfully");
      setSuccess(SuccessMessages.ACCESS_VERIFIED);
      showSuccess(SuccessMessages.ACCESS_VERIFIED);

      // Store candidate data and redirect to welcome page
      sessionStorage.setItem(
        "candidate_data",
        JSON.stringify(result.candidate)
      );
      setTimeout(() => {
        window.location.href = "/candidate/welcome";
      }, 1500);
    } catch (err) {
      console.error("Access key verification error:", err);
      setError(ErrorMessages.NETWORK_ERROR);
      showError(ErrorMessages.NETWORK_ERROR);
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          How to get your access key:
        </h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Contact your interviewer or HR department</p>
          <p>• Check your email for interview invitation</p>
          <p>• Access key is case-sensitive</p>
          <p>• Contact support if you don&apos;t have an access key</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="accessKey"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Interview Access Key
          </label>
          <div className="relative">
            <input
              type="text"
              id="accessKey"
              value={accessKey}
              onChange={(e) => {
                setAccessKey(e.target.value);
                if (error) setError("");
              }}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white placeholder-gray-500"
              placeholder="Enter your access key"
              required
              disabled={isLoading}
            />
            <Key className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !accessKey.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <Key className="w-5 h-5" />
              <span>Start Interview</span>
            </>
          )}
        </button>
      </form>

      {/* Help Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Need Help?</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <p>• Make sure you have the correct access key</p>
          <p>• Check your internet connection</p>
          <p>• Contact your interviewer if you&apos;re having trouble</p>
        </div>
      </div>
    </div>
  );
}
