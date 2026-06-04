"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes - log out after this inactivity
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - only ping when user has been active

/** Track admin activity; refresh session only when active; auto logout after 10 min idle. */
export default function SessionHeartbeat() {
  const pathname = usePathname();
  const lastActivityRef = useRef(Date.now());
  const checkIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    if (!pathname?.startsWith("/admin/") || pathname === "/admin/login") {
      return;
    }

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, updateActivity));

    const performLogout = () => {
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      if (typeof window !== "undefined") {
        localStorage.removeItem("authToken");
        localStorage.removeItem("token");
        window.location.href = "/admin/login?idle=1&error=" + encodeURIComponent("You were logged out after 10 minutes of inactivity.");
      }
    };

    const checkIdle = () => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_MS) {
        performLogout();
      }
    };

    checkIntervalRef.current = setInterval(checkIdle, CHECK_INTERVAL_MS);

    const ping = () => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_MS) return;
      fetch("/api/auth/verify", { method: "GET", credentials: "include" })
        .then((res) => {
          if (res.status === 401) {
            window.location.href =
              "/admin/login?expired=true&error=" +
              encodeURIComponent("Session expired. You were logged out after 10 minutes of inactivity.");
          }
        })
        .catch(() => {});
    };

    heartbeatIntervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    ping();

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [pathname]);

  return null;
}
