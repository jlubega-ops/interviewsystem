"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds

/**
 * Logs out the candidate after 5 minutes of inactivity (session expiry).
 * Resets the idle timer on user interaction (mouse, keyboard, touch, scroll).
 * Only runs when candidate_data exists in sessionStorage (candidate is logged in).
 *
 * Does NOT submit the interview attempt. So if the interview is 60 min and session
 * expires at 5 min, when they log back in they can resume with remaining attempt time.
 * Auto-submit / completion is based only on attempt time (interview duration), not session expiry.
 */
export function useCandidateIdleLogout() {
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem("candidate_data")) return;

    const performLogout = async () => {
      try {
        const raw = sessionStorage.getItem("candidate_data");
        if (raw) {
          const data = JSON.parse(raw);
          if (data.id && data.accessKey) {
            await fetch("/api/candidate/logout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidateId: data.id, accessKey: data.accessKey }),
            });
          }
        }
      } catch (_) {}
      sessionStorage.removeItem("candidate_data");
      sessionStorage.removeItem("current_interview");
      router.push("/candidate?idle=1");
    };

    const checkIdle = () => {
      if (!sessionStorage.getItem("candidate_data")) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_MS) {
        performLogout();
      }
    };

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, updateActivity));

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [router]);
}
