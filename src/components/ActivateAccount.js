"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import AccessFormBrand from "./AccessFormBrand";

export default function ActivateAccount() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      verifyToken(tokenParam);
    } else {
      setError("Activation token is required");
      setIsVerifying(false);
    }
  }, [searchParams]);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`/api/auth/activate-account?token=${token}`);
      const result = await response.json();

      if (response.ok) {
        setUser(result.user);
        setIsVerifying(false);
      } else {
        setError(result.error || "Invalid or expired activation token");
        setIsVerifying(false);
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      setError("Failed to verify activation token");
      setIsVerifying(false);
    }
  };

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
      const response = await fetch("/api/auth/activate-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(result.message);
        setPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error || "Failed to activate account");
      }
    } catch (error) {
      console.error("Error activating account:", error);
      setError("Failed to activate account");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <Image
            src="/images/logo.png"
            alt="MUBS EIIC Logo"
            width={80}
            height={80}
            className="rounded-xl mx-auto mb-6 object-contain"
            priority
          />
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying activation token...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <AccessFormBrand
          title="Activate Account"
          subtitle={
            user
              ? `Set your password for ${user.email}`
              : "Complete your account setup"
          }
        />

        {/* Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span>{success}</span>
                <button
                  onClick={() => setSuccess(null)}
                  className="ml-auto text-green-600 hover:text-green-800"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                placeholder="Enter your password"
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>

            {/* Confirm Password Input */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white placeholder-gray-500"
                placeholder="Confirm your password"
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center space-x-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Activate Account</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/admin/login"
              className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/admin/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
