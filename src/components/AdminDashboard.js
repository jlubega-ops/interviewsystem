"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, BarChart3, CheckCircle, BookOpen, FileText, FolderOpen, PieChart } from "lucide-react";
import NavigationHeader from "./NavigationHeader";

const defaultStats = {
  totalCohorts: 0,
  totalInterviews: 0,
  completedToday: 0,
  completionRate: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(defaultStats);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    verifySession();

    let refreshTimeout;
    const REFRESH_DEBOUNCE_MS = 60 * 1000;
    const handleActivity = () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        fetch("/api/auth/verify", { method: "GET", credentials: "include" })
          .then((res) => {
            if (res.status === 401) {
              window.location.href = "/admin/login?expired=true&error=Session%20expired";
            }
          })
          .catch(() => {});
      }, REFRESH_DEBOUNCE_MS);
    };

    const events = ["mousedown", "keydown", "keypress", "scroll", "touchstart"];
    events.forEach((event) => document.addEventListener(event, handleActivity, true));
    return () => {
      clearTimeout(refreshTimeout);
      events.forEach((event) => document.removeEventListener(event, handleActivity, true));
    };
  }, []);

  const verifySession = async () => {
    try {
      const response = await fetch("/api/auth/verify", { method: "GET", credentials: "include" });
      if (response.ok) {
        const result = await response.json();
        setUser(result.user);
        setTimeout(() => fetchStats(), 100);
      } else {
        window.location.href = "/admin/login";
      }
    } catch (error) {
      console.error("Session verification failed:", error);
      window.location.href = "/admin/login";
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats", { method: "GET", credentials: "include" });
      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Cohorts",
      value: stats.totalCohorts,
      sub: `${stats.activeCohorts ?? 0} with enrollments`,
      icon: BookOpen,
      color: "blue",
    },
    {
      label: "Interviews",
      value: stats.totalInterviews,
      sub: `${stats.activeInterviews ?? 0} active`,
      icon: BarChart3,
      color: "indigo",
    },
    {
      label: "Completed today",
      value: stats.completedToday,
      sub: `${stats.recentSessions ?? 0} started this week`,
      icon: CheckCircle,
      color: "green",
    },
    {
      label: "Completion rate",
      value: `${stats.completionRate ?? 0}%`,
      sub: "of all attempts",
      icon: BarChart3,
      color: "purple",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    indigo: "bg-indigo-100 text-indigo-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <NavigationHeader
        title="Admin Dashboard"
        subtitle={user ? `Welcome, ${user.fullName}` : "Dashboard"}
        icon="Home"
        showBackButton={false}
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }]}
      />

      <main className="flex-1 min-h-0 overflow-auto max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.fullName || "Admin"}
          </h1>
          <p className="text-gray-600 mt-1">
            Manage cohorts, interviews, and users.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                    {card.sub && (
                      <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[card.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/cohorts"
            className="group flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Cohorts</h3>
              <p className="text-sm text-gray-500">Create and manage cohorts, assign interviews</p>
            </div>
          </Link>

          <Link
            href="/admin/question-banks"
            className="group flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <FolderOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Question Banks</h3>
              <p className="text-sm text-gray-500">Reusable question banks for aptitude interviews</p>
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="group flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Users</h3>
              <p className="text-sm text-gray-500">Manage examiners and facilitators</p>
            </div>
          </Link>

          {(user?.role === "ADMIN" || user?.role === "SUPERADMIN") && (
            <Link
              href="/admin/logs"
              className="group flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-slate-200 transition-all"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Activity Logs</h3>
                <p className="text-sm text-gray-500">View audit trail of user and candidate actions</p>
              </div>
            </Link>
          )}

          {(user?.role === "ADMIN" || user?.role === "SUPERADMIN") && (
            <Link
              href="/admin/reports"
              className="group flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all"
            >
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                <PieChart className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Reports</h3>
                <p className="text-sm text-gray-500">Completion, performance, cohorts and submission reports</p>
              </div>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
