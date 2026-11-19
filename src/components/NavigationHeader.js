"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  LogOut,
  LogIn,
  User,
  Home,
  Users,
  BookOpen,
  FileText,
  FolderOpen,
  Settings,
  ChevronDown,
  Menu,
  Building2,
} from "lucide-react";
import { useAdminNav } from "./AdminShell";

// Icon mapping for string-based icon selection
const iconMap = {
  Home,
  Users,
  BookOpen,
  FileText,
  FolderOpen,
  Settings,
  ArrowLeft,
  LogOut,
  LogIn,
  Building2,
};
import Link from "next/link";
import ConfirmationDialog from "./ConfirmationDialog";

function getInitials(fullName, email) {
  if (fullName && typeof fullName === "string") {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && typeof email === "string") return email[0].toUpperCase();
  return "?";
}

export default function NavigationHeader({
  title,
  subtitle,
  icon,
  showBackButton = false,
  backHref,
  backText = "Back",
  breadcrumbs = [],
  showLogout = true,
  className = "",
}) {
  const Icon = typeof icon === "string" ? iconMap[icon] : icon;
  const adminNav = useAdminNav();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch("/api/auth/verify", { method: "GET", credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data?.user && setCurrentUser(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileDropdownOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        window.location.href = "/admin/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/admin/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getBreadcrumbIcon = (path) => {
    if (path.includes("dashboard")) return Home;
    if (path.includes("users")) return Users;
    if (path.includes("cohorts")) return BookOpen;
    if (path.includes("question-banks")) return FolderOpen;
    if (path.includes("interviews")) return FileText;
    if (path.includes("settings")) return Settings;
    return null;
  };

  return (
    <>
      <header
        className={`sticky top-0 z-30 flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-4">
              {adminNav ? (
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => adminNav.setMobileOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
              ) : null}
              {/* Icon */}
              {Icon && (
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              )}

              {/* Title and Breadcrumbs */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  {showBackButton && backHref && (
                    <Link
                      href={backHref}
                      className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-sm font-medium">{backText}</span>
                    </Link>
                  )}

                  {/* Breadcrumbs */}
                  {breadcrumbs.length > 0 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      {breadcrumbs.map((crumb, index) => {
                        const BreadcrumbIcon = getBreadcrumbIcon(crumb.href);
                        return (
                          <div
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            {index > 0 && <span>/</span>}
                            <Link
                              href={crumb.href}
                              className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                            >
                              {BreadcrumbIcon && (
                                <BreadcrumbIcon className="w-3 h-3" />
                              )}
                              <span>{crumb.label}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && <p className="text-gray-600">{subtitle}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Profile dropdown */}
              {showLogout && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen((o) => !o)}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    title="Profile"
                    aria-expanded={profileDropdownOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {currentUser ? getInitials(currentUser.fullName, currentUser.email) : <User className="w-4 h-4" />}
                    </div>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${profileDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <Link
                        href="/admin/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <User className="w-4 h-4" />
                        <span>View profile</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setShowLogoutDialog(true);
                        }}
                        className="flex w-full items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout? You will need to sign in again to access the system."
        type="warning"
        confirmText="Logout"
        cancelText="Cancel"
        isLoading={isLoggingOut}
      />
    </>
  );
}
