"use client";

import Image from "next/image";

/**
 * Full-page layout with the MUBS building photo as a visible background.
 */
export default function BuildingBackgroundPage({
  children,
  overlayClassName = "bg-white/50 backdrop-blur-[1px]",
  className = "",
}) {
  return (
    <div className={`relative min-h-screen flex flex-col ${className}`.trim()}>
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Image
          src="/images/building.jpg"
          alt=""
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div
          className={`absolute inset-0 ${overlayClassName}`.trim()}
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-indigo-900/15"
          aria-hidden
        />
      </div>
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        {children}
      </div>
    </div>
  );
}
