"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, ArrowRight, LogIn, Key } from "lucide-react";
import BuildingBackgroundPage from "./BuildingBackgroundPage";

export default function WelcomePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        await fetch("/api/system/status", { method: "GET" });
      } catch (error) {
        console.error("Failed to check system status:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSystemStatus();
  }, []);

  if (isLoading) {
    return (
      <BuildingBackgroundPage overlayClassName="bg-white/45">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-white/70 backdrop-blur-md rounded-2xl px-8 py-6 shadow-lg border border-white/60">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Loading...</p>
          </div>
        </div>
      </BuildingBackgroundPage>
    );
  }

  return (
    <BuildingBackgroundPage overlayClassName="bg-white/45 backdrop-blur-[2px]">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/70 backdrop-blur-md border-b border-white/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/logo.png"
                alt="MUBS EIIC Logo"
                width={40}
                height={40}
                className="rounded-lg shadow-sm"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">MUBS EIIC</h1>
                <p className="text-xs text-gray-700">Interview System</p>
              </div>
            </div>
            <Link
              href="/admin/login"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 bg-white/60 hover:bg-white/90 px-3 py-2 rounded-lg border border-gray-200/80 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="text-sm font-medium">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main — centered hero over the background */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-2xl text-center">
          <div className="bg-white/75 backdrop-blur-md rounded-3xl shadow-2xl border border-white/60 px-6 py-10 sm:px-10 sm:py-12">
            <Image
              src="/images/logo.png"
              alt="MUBS EIIC Logo"
              width={96}
              height={96}
              className="rounded-2xl mx-auto mb-5 object-contain shadow-md"
              priority
            />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Welcome to MUBS EIIC
            </h1>
            <p className="text-lg text-gray-700 mb-1">
              Entrepreneurship Incubation and Innovation Centre
            </p>
            <p className="text-sm text-gray-600 mb-8 max-w-md mx-auto">
              Join our innovative community and take your entrepreneurial journey
              to the next level.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/candidate"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Key className="w-4 h-4" />
                <span>Start Interview</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center space-x-2 bg-white/90 text-gray-800 px-6 py-3.5 rounded-xl font-semibold border-2 border-gray-200 hover:border-gray-300 hover:bg-white transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Portal</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/60 backdrop-blur-md border-t border-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-center text-sm text-gray-700">
            <span suppressHydrationWarning>
              &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
            </span>
          </p>
        </div>
      </footer>
    </BuildingBackgroundPage>
  );
}
