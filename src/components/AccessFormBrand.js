"use client";

import Image from "next/image";

/**
 * Company logo and title block for login, password reset, activation, and candidate access forms.
 */
export default function AccessFormBrand({ title, subtitle, className = "" }) {
  return (
    <div className={`text-center mb-8 ${className}`.trim()}>
      <Image
        src="/images/logo.png"
        alt="MUBS EIIC Logo"
        width={80}
        height={80}
        className="rounded-xl mx-auto mb-3 object-contain"
        priority
      />
      <p className="text-sm font-semibold text-gray-800 tracking-wide mb-4">
        MUBS EIIC
      </p>
      {title ? (
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      ) : null}
      {subtitle ? (
        <p className="text-gray-600 text-sm">{subtitle}</p>
      ) : null}
    </div>
  );
}
