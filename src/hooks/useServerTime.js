"use client";

import { useState, useEffect, useMemo } from "react";

const SYNC_INTERVAL_MS = 60 * 1000;
const TICK_MS = 1000;

/**
 * Returns current time from the server. Use this everywhere instead of new Date()
 * so that cohort open/close, timers, and any time-based logic are not affected by
 * wrong client clock.
 * @returns {{ serverNow: Date, isReady: boolean }}
 */
export function useServerTime() {
  const [serverTime, setServerTime] = useState(null);
  const [clientReceiveTime, setClientReceiveTime] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await fetch("/api/server-time", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setServerTime(data.serverTime);
          setClientReceiveTime(Date.now());
        }
      } catch (e) {
        console.error("Failed to fetch server time:", e);
      }
    };

    fetchServerTime();
    const syncInterval = setInterval(fetchServerTime, SYNC_INTERVAL_MS);
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    if (serverTime == null) return;
    const tickInterval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(tickInterval);
  }, [serverTime]);

  const serverNow = useMemo(() => {
    if (serverTime == null || clientReceiveTime == null) return null;
    const elapsed = Date.now() - clientReceiveTime;
    return new Date(serverTime + elapsed);
  }, [serverTime, clientReceiveTime, tick]);

  return {
    serverNow,
    isReady: serverNow !== null,
  };
}
