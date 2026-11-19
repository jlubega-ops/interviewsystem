"use client";

import { useEffect, useState, Suspense } from "react";
import { Key } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoginForm from "../../../components/LoginForm";
import AccessFormBrand from "../../../components/AccessFormBrand";
import AuthSplitLayout from "../../../components/AuthSplitLayout";

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState("amber");

  useEffect(() => {
    const expired = searchParams.get("expired");
    const error = searchParams.get("error");
    const idle = searchParams.get("idle");
    const activated = searchParams.get("activated");
    const passwordReset = searchParams.get("passwordReset");

    if (activated === "success") {
      setBannerTone("green");
      setBannerMessage(
        "Your account has been activated. Please sign in with your new password."
      );
      return;
    }
    if (passwordReset === "success") {
      setBannerTone("green");
      setBannerMessage(
        "Your password has been reset. Please sign in with your new password."
      );
      return;
    }

    setBannerTone("amber");
    if (
      idle === "1" ||
      (error &&
        decodeURIComponent(error || "").toLowerCase().includes("inactivity"))
    ) {
      setBannerMessage(
        "You were logged out after 10 minutes of inactivity. Please log in again."
      );
    } else if (
      expired === "true" ||
      error === "Session expired" ||
      error === "Invalid session"
    ) {
      setBannerMessage("Your session has expired. Please log in again.");
    } else {
      setBannerMessage("");
    }
  }, [searchParams]);

  return (
    <AuthSplitLayout
      footer={
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-700 font-medium"
        >
          <Key className="w-4 h-4" />
          I am a candidate — start interview
        </Link>
      }
    >
      <AccessFormBrand
        showLogo={false}
        title="Welcome back"
        subtitle="Sign in as admin or examiner to manage interviews."
      />

      {bannerMessage ? (
        <div
          className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
            bannerTone === "green"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {bannerMessage}
        </div>
      ) : null}

      <LoginForm />
    </AuthSplitLayout>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
