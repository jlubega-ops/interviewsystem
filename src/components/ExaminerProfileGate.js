"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, ArrowRight } from "lucide-react";

export default function ExaminerProfileGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === "/admin/profile") {
      setLoading(false);
      setShowModal(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/auth/verify", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const user = data?.user;
        const isExaminer = user?.role === "EXAMINER";
        const profileComplete = user?.profileComplete === true;
        setShowModal(!!isExaminer && !profileComplete);
      })
      .catch(() => {
        if (!cancelled) setShowModal(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [pathname]);

  const goToProfile = () => {
    router.push("/admin/profile");
  };

  if (loading) {
    return children;
  }

  if (!showModal) {
    return children;
  }

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full mx-4 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Complete your profile
          </h2>
          <p className="text-gray-600 mb-6">
            You need to update your profile with all required fields (organisation and contact) before you can use the system. You cannot skip this step.
          </p>
          <button
            onClick={goToProfile}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Go to profile
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
