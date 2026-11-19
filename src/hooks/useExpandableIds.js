"use client";

import { useMemo, useState } from "react";

export function useExpandableIds(ids = []) {
  const [openIds, setOpenIds] = useState(() => new Set());
  const idList = useMemo(() => ids.filter(Boolean), [ids]);

  const allExpanded =
    idList.length > 0 && idList.every((id) => openIds.has(id));

  const isExpanded = (id) => openIds.has(id);

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenIds(new Set(idList));
  const collapseAll = () => setOpenIds(new Set());
  const toggleAll = () => {
    if (allExpanded) collapseAll();
    else expandAll();
  };

  return { isExpanded, toggle, toggleAll, allExpanded };
}
