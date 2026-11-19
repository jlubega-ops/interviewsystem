"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import AccessFormBrand from "./AccessFormBrand";
import AuthSplitLayout from "./AuthSplitLayout";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  const verifyToken = useCallback(async (tokenValue) => {
    try {
      const response = await fetch(
        `/api/auth/reset-password?token=${encodeURIComponent(tokenValue)}`
      );
      const result = await response.json();

      if (response.ok) {
        setUser(result.user);
        setError(null);
      } else {
        setUser(null);
        setError(result.error || "Invalid or expired reset token");
      }
    } catch (err) {
      console.error("Error verifying token:", err);
      setUser(null);
      setError("Failed to verify reset token");
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setUser(null);
      setError("Reset token is required");
      setIsVerifying(false);
    }
  }, [searchParams, verifyToken]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push("/admin/login?passwordReset=success");
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError("Password must contain at least one letter and one number");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(
          result.message || "Password reset successfully. Redirecting to login..."
        );
        setPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error || "Failed to reset password");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      setError("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthSplitLayout>
        <div className="text-center py-8">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset token...</p>
        </div>
      </AuthSplitLayout>
    );
  }

  const tokenValid = !!user;
  const showPasswordForm = tokenValid && !success;

  return (
    <AuthSplitLayout>
      <AccessFormBrand
        showLogo={false}
        title="Reset password"
        subtitle={
          success
            ? "You will be redirected to the login page shortly."
            : tokenValid
              ? `Set a new password for ${user.email}`
              : "This reset link is invalid or has expired."
        }
      />

      <div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-red-800 mb-6">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              {showPasswordForm && (
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-800 mb-6">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {showPasswordForm ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                  placeholder="Enter new password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center space-x-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Reset Password</span>
                  </>
                )}
              </button>
            </form>
          ) : !success ? (
            <p className="text-sm text-gray-600 text-center mb-4">
              Request a new reset link or return to login.
            </p>
          ) : null}

          <div className="mt-6 text-center space-y-3">
            {!tokenValid && !success && (
              <Link
                href="/forgot-password"
                className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Request a new reset link
              </Link>
            )}
            <Link
              href="/admin/login"
              className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{success ? "Go to Login now" : "Back to Login"}</span>
            </Link>
          </div>
        </div>
    </AuthSplitLayout>
  );
}
