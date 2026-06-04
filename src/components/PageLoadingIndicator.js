/**
 * Global page loading indicator: top progress bar + centered spinner.
 * Used by app/loading.js so users see feedback during route transitions.
 */
export default function PageLoadingIndicator() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white/90 backdrop-blur-[2px]" aria-live="polite" aria-busy="true">
      {/* Top progress bar */}
      <div className="h-1 w-full overflow-hidden bg-gray-200">
        <div
          className="h-full w-1/3 min-w-[120px] rounded-full bg-indigo-600"
          style={{
            animation: "page-loading-shimmer 1.5s ease-in-out infinite",
          }}
        />
      </div>
      {/* Centered spinner + label */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600"
            style={{
              animation: "page-loading-spin 0.8s linear infinite",
            }}
          />
          <p className="text-sm font-medium text-gray-600">Loading…</p>
        </div>
      </div>
    </div>
  );
}
