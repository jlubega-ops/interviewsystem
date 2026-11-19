"use client";

import { useEffect, useState } from "react";
import { Users, Calendar, Clock } from "lucide-react";
import StatsStrip from "./StatsStrip";

const emptyStats = {
  totalCohorts: 0,
  activeCohorts: 0,
  enrolledCandidates: 0,
  activeSessions: 0,
};

export default function CohortStatsCards() {
  const [stats, setStats] = useState(emptyStats);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/stats", { method: "GET", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (cancelled || !result?.data) return;
        setStats({
          totalCohorts: result.data.totalCohorts ?? 0,
          activeCohorts: result.data.activeCohorts ?? 0,
          enrolledCandidates: result.data.enrolledCandidates ?? 0,
          activeSessions: result.data.activeSessions ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StatsStrip
      items={[
        {
          label: "Cohorts",
          value: stats.totalCohorts,
          sub: `${stats.activeCohorts} open`,
          icon: Users,
          iconClass: "text-blue-600",
        },
        {
          label: "Enrolled",
          value: stats.enrolledCandidates,
          icon: Calendar,
          iconClass: "text-green-600",
        },
        {
          label: "Active sessions",
          value: stats.activeSessions,
          icon: Clock,
          iconClass: "text-amber-600",
        },
      ]}
    />
  );
}
