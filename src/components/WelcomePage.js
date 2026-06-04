"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, Shield, ArrowRight, LogIn, Key } from "lucide-react";

export default function WelcomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    // Check system status
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch("/api/system/status", {
        method: "GET",
      });

      if (response.ok) {
        const result = await response.json();
        setSystemStatus(result);
      }
    } catch (error) {
      console.error("Failed to check system status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/logo.png"
                alt="MUBS EIIC Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">MUBS EIIC</h1>
                <p className="text-xs text-gray-600">Interview System</p>
              </div>
            </div>
            <Link
              href="/admin/login"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="text-sm font-medium">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - fills remaining space, no scroll */}
      <main className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch flex-1 min-h-0 w-full">
          {/* Left Column - Building Image (full height) */}
          <div className="order-2 lg:order-1 min-h-[200px] lg:min-h-0 flex items-stretch justify-center">
            <div className="relative w-full h-full min-h-[200px] rounded-2xl shadow-xl overflow-hidden bg-gray-100">
              <Image
                src="/images/building.jpg"
                alt="MUBS Building"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Right Column - Content */}
          <div className="order-1 lg:order-2 flex flex-col justify-center text-center lg:text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Welcome to MUBS EIIC
            </h1>
            <p className="text-base lg:text-lg text-gray-600 mb-2">
              Entrepreneurship Incubation and Innovation Centre
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Join our innovative community and take your entrepreneurial journey to the next level.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/candidate"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Key className="w-4 h-4" />
                <span>Start Interview</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center space-x-2 bg-white text-gray-700 px-6 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Portal</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/60 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-center text-sm text-gray-600">
            <span suppressHydrationWarning>
              &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
