"use client";

import { useMemo, useState } from "react";

export function useClientTable(rows, { searchText, pageSize = 10 } = {}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      String(searchText ? searchText(row) : "").toLowerCase().includes(q)
    );
  }, [rows, query, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return {
    query,
    setQuery: (value) => {
      setQuery(value);
      setPage(1);
    },
    page: safePage,
    setPage,
    pageSize,
    totalPages,
    pageRows,
    filtered,
    filteredCount: filtered.length,
    totalCount: rows.length,
  };
}
