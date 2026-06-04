"use client";

import { WifiOff } from "lucide-react";

/**
 * Full-screen overlay when the user is offline during an attempt.
 * Blurs the background, blocks interaction, and tells the user to reconnect.
 * Time is still running (does not stop).
 */
export default function OfflineOverlay({ isOffline }) {
  if (!isOffline) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
      aria-modal="true"
      role="alertdialog"
      aria-labelledby="offline-title"
      aria-describedby="offline-desc"
    >
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        style={{ pointerEvents: "auto" }}
      />
      {/* Modal card */}
      <div className="relative z-10 mx-4 max-w-md rounded-xl border border-gray-700 bg-gray-900/95 p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-amber-500/20 p-4">
            <WifiOff className="h-12 w-12 text-amber-400" aria-hidden />
          </div>
          <h2
            id="offline-title"
            className="text-xl font-semibold text-white"
          >
            You&apos;re offline
          </h2>
          <p id="offline-desc" className="text-gray-300">
            Please reconnect to the internet. Your interview timer is still
            running and will not stop until you submit or time runs out.
          </p>
          <p className="text-sm text-amber-400/90">
            Reconnect now to continue and save your progress.
          </p>
        </div>
      </div>
    </div>
  );
}
