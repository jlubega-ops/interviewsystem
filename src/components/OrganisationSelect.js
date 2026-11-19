"use client";

import { useEffect, useState } from "react";

export default function OrganisationSelect({
  id = "organisation",
  name = "organisation",
  value,
  onChange,
  required = false,
  disabled = false,
  className = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white",
}) {
  const [orgs, setOrgs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organisations?active=1", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (cancelled) return;
        setOrgs(result?.data || []);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <select
        id={id}
        name={name}
        value={value || ""}
        onChange={onChange}
        required={required}
        disabled={disabled || !loaded}
        className={className}
      >
        <option value="">
          {loaded ? "Select organisation" : "Loading organisations..."}
        </option>
        {orgs.map((org) => (
          <option key={org.id} value={org.name}>
            {org.name}
          </option>
        ))}
        {value && !orgs.some((org) => org.name === value) ? (
          <option value={value}>{value} (inactive)</option>
        ) : null}
      </select>
      {loaded && orgs.length === 0 ? (
        <p className="mt-1 text-sm text-amber-700">
          No organisations yet. A system admin must add them first.
        </p>
      ) : null}
    </div>
  );
}
