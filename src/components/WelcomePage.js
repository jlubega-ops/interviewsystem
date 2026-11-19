"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Key, LogIn } from "lucide-react";
import AuthSplitLayout from "./AuthSplitLayout";
import AccessFormBrand from "./AccessFormBrand";
import CandidateAccessForm from "./CandidateAccessForm";
import LoginForm from "./LoginForm";

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [panel, setPanel] = useState("candidate");
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState("amber");
  const [adminUser, setAdminUser] = useState(null);
  const idleLogout = searchParams.get("idle") === "1";

  useEffect(() => {
    fetch("/api/auth/verify", { method: "GET", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setAdminUser(data.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (adminUser && searchParams.get("view") === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [adminUser, searchParams, router]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "admin") setPanel("admin");

    const expired = searchParams.get("expired");
    const error = searchParams.get("error");
    const idle = searchParams.get("idle");
    const activated = searchParams.get("activated");
    const passwordReset = searchParams.get("passwordReset");

    if (activated === "success") {
      setPanel("admin");
      setBannerTone("green");
      setBannerMessage(
        "Your account has been activated. Please sign in with your new password."
      );
      return;
    }
    if (passwordReset === "success") {
      setPanel("admin");
      setBannerTone("green");
      setBannerMessage(
        "Your password has been reset. Please sign in with your new password."
      );
      return;
    }

    setBannerTone("amber");
    if (
      idle === "1" &&
      error &&
      decodeURIComponent(error || "").toLowerCase().includes("inactivity")
    ) {
      setPanel("admin");
      setBannerMessage(
        "You were logged out after 10 minutes of inactivity. Please log in again."
      );
    } else if (
      expired === "true" ||
      error === "Session expired" ||
      error === "Invalid session"
    ) {
      setPanel("admin");
      setBannerMessage("Your session has expired. Please log in again.");
    } else {
      setBannerMessage("");
    }
  }, [searchParams]);

  const isAdmin = panel === "admin";

  return (
    <AuthSplitLayout
      headerRight={
        isAdmin ? null : (
          <button
            type="button"
            onClick={() => {
              if (adminUser) {
                router.push("/admin/dashboard");
                return;
              }
              setPanel("admin");
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 bg-white/90 hover:bg-white border border-white/70 shadow-md px-3.5 py-2 rounded-lg backdrop-blur-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {adminUser ? "Dashboard" : "Admin login"}
          </button>
        )
      }
      footer={
        isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setPanel("candidate");
              setBannerMessage("");
            }}
            className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-700 font-medium"
          >
            <Key className="w-4 h-4" />
            I am a candidate — start interview
          </button>
        ) : null
      }
    >
      <div className={isAdmin ? "block" : "hidden"}>
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
      </div>
      <div className={isAdmin ? "hidden" : "block"}>
        <AccessFormBrand
          showLogo={false}
          title="Start your interview"
          subtitle="Enter the access key you were given to begin."
        />
        {idleLogout ? (
          <div className="mb-6 p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 text-sm font-medium">
            You were logged out due to inactivity. Enter your access key to
            continue.
          </div>
        ) : null}
        <CandidateAccessForm />
      </div>
    </AuthSplitLayout>
  );
}
