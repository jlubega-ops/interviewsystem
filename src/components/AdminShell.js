"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  FolderOpen,
  Users,
  Building2,
  FileText,
  PieChart,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

const AdminNavContext = createContext(null);

export function useAdminNav() {
  return useContext(AdminNavContext);
}

const STORAGE_KEY = "admin-sidebar-collapsed";
const STAFF_ROLES = ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"];

function isStaffAuthPage(pathname) {
  return (
    pathname === "/admin/login" ||
    pathname?.startsWith("/admin/login/")
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const onAdminApp =
    pathname?.startsWith("/admin") && !isStaffAuthPage(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!onAdminApp) {
      setUser(null);
      setSessionChecked(true);
      return;
    }
    setSessionChecked(false);
    fetch("/api/auth/verify", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const nextUser = data?.user || null;
        if (nextUser && STAFF_ROLES.includes(nextUser.role)) {
          setUser(nextUser);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setSessionChecked(true));
  }, [onAdminApp]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isStaff = user && STAFF_ROLES.includes(user.role);
  if (!onAdminApp || (sessionChecked && !isStaff)) {
    return children;
  }

  const role = user?.role;
  const canManageUsers = role === "SUPERADMIN" || role === "ADMIN";
  const isSuperadmin = role === "SUPERADMIN";
  const roleLabel =
    role === "SUPERADMIN"
      ? "System admin"
      : role === "ADMIN"
        ? "Admin"
        : role === "EXAMINER"
          ? "Examiner"
          : role === "FACILITATOR"
            ? "Facilitator"
            : "Staff";

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/cohorts", label: "Cohorts", icon: BookOpen },
    { href: "/admin/question-banks", label: "Question Banks", icon: FolderOpen },
    canManageUsers ? { href: "/admin/users", label: "Users", icon: Users } : null,
    isSuperadmin
      ? { href: "/admin/organisations", label: "Organisations", icon: Building2 }
      : null,
    canManageUsers ? { href: "/admin/reports", label: "Reports", icon: PieChart } : null,
    canManageUsers
      ? { href: "/admin/logs", label: "Activity Logs", icon: FileText }
      : null,
    { href: "/admin/profile", label: "Profile", icon: User },
  ].filter(Boolean);

  const isActive = (href) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const sidebarInner = (
    <>
      <div className="flex items-center gap-2 px-3 h-16 border-b border-slate-800 shrink-0">
        <Image
          src="/images/logo.png"
          alt="MUBS EIIC"
          width={32}
          height={32}
          className="rounded-md object-contain shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">MUBS EIIC</p>
            <p className="text-[11px] text-slate-400 truncate">Interview System</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto lg:hidden text-slate-300 hover:text-white p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-slate-800 space-y-2">
        {!collapsed && user ? (
          <div className="px-3 py-2 text-xs text-slate-400 truncate">
            <p className="text-slate-200 truncate">{user.fullName || user.email}</p>
            <p>{roleLabel}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white text-sm"
          title={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5" />
              <span>Close sidebar</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <AdminNavContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen, user }}
    >
      <div className="min-h-screen bg-slate-50">
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
            aria-label="Close sidebar overlay"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-[70] lg:z-40 flex flex-col bg-slate-900 text-white transition-all duration-200 ease-out
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0
            ${collapsed ? "lg:w-16 w-64" : "w-64"}`}
        >
          {sidebarInner}
        </aside>

        <div
          className={`min-h-screen transition-[padding] duration-200 ${
            collapsed ? "lg:pl-16" : "lg:pl-64"
          }`}
        >
          {children}
        </div>
      </div>
    </AdminNavContext.Provider>
  );
}
