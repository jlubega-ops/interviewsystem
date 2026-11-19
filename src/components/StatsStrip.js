"use client";

export default function StatsStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
        >
          {item.icon ? (
            <item.icon className={`w-3.5 h-3.5 ${item.iconClass || "text-gray-500"}`} />
          ) : null}
          <span className="text-gray-500">{item.label}</span>
          <span className="font-semibold text-gray-900">{item.value}</span>
          {item.sub ? (
            <span className="text-xs text-gray-400 hidden sm:inline">{item.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
