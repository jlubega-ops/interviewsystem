"use client";

import Link from "next/link";
import Image from "next/image";

export default function AuthSplitLayout({
  headerRight = null,
  footer = null,
  children,
}) {
  return (
    <div className="relative min-h-screen bg-white flex flex-col-reverse lg:flex-row">
      {headerRight ? (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
          {headerRight}
        </div>
      ) : null}

      <section className="relative flex w-full flex-col min-h-[58vh] lg:min-h-screen lg:w-1/2 px-6 sm:px-10 lg:px-12 py-5">
        <header className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/images/logo.png"
              alt="MUBS EIIC"
              width={40}
              height={40}
              className="rounded-lg object-contain shrink-0"
              priority
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">
                MUBS EIIC
              </p>
              <p className="text-xs text-gray-500 truncate">Interview System</p>
            </div>
          </Link>
        </header>

        <div className="flex-1 flex flex-col justify-center py-5">
          <div className="w-full max-w-md mx-auto">{children}</div>
        </div>

        <footer className="shrink-0 pt-2 pb-1 text-center space-y-3">
          {footer}
          <p className="text-xs text-gray-400" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} MUBS EIIC. All rights reserved.
          </p>
        </footer>
      </section>

      <aside className="relative h-52 sm:h-72 lg:h-auto lg:w-1/2 lg:min-h-screen overflow-hidden bg-slate-200">
        {/* Native img: the building photo is large; next/image optimizer times out on it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/eiicbuilding.png"
          alt="MUBS EIIC building"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </aside>
    </div>
  );
}
