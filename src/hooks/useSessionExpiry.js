"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to handle session expiry on page refresh
 * Clears any stale tokens and handles expired sessions gracefully
 */
export function useSessionExpiry() {
  const router = useRouter();

  useEffect(() => {
    // Check for expired session on mount
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          // Session is invalid or expired
          const result = await response.json();
          
          // Clear any stale localStorage tokens
          if (typeof window !== "undefined") {
            localStorage.removeItem("authToken");
            localStorage.removeItem("token");
          }

          // If we're not already on the login page, redirect with expired message
          if (window.location.pathname !== "/admin/login") {
            router.push("/admin/login?expired=true&error=" + encodeURIComponent(result.error || "Session expired"));
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
        // On error, clear tokens and redirect to login
        if (typeof window !== "undefined") {
          localStorage.removeItem("authToken");
          localStorage.removeItem("token");
          
          if (window.location.pathname !== "/admin/login") {
            router.push("/admin/login?expired=true");
          }
        }
      }
    };

    // Only check session if we're on a protected admin route
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/") && window.location.pathname !== "/admin/login") {
      checkSession();
    }
  }, [router]);
}

