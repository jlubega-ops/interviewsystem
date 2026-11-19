"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export function onTableRowClick(handler) {
  return (event) => {
    if (event.target.closest("a, button, input, select, textarea, label")) return;
    handler(event);
  };
}

export function TableSearch({
  query,
  setQuery,
  placeholder = "Search...",
  filteredCount,
  totalCount,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
        />
      </div>
      <p className="text-xs text-gray-500 whitespace-nowrap">
        {filteredCount === totalCount
          ? `${totalCount} item${totalCount === 1 ? "" : "s"}`
          : `${filteredCount} of ${totalCount}`}
      </p>
    </div>
  );
}

export function TablePager({ page, setPage, totalPages, filteredCount, pageSize }) {
  if (filteredCount <= pageSize && totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-100"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
