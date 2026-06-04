/**
 * Public app origin for links in emails (activation, password reset).
 * Set NEXT_PUBLIC_BASE_URL in .env (e.g. http://localhost:3000 or https://your-domain.com).
 */
export function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[appUrl] NEXT_PUBLIC_BASE_URL is not set. Email links may be invalid."
    );
  }

  return "http://localhost:3000";
}

/** Build an absolute path on the app (path must start with /). */
export function appAbsoluteUrl(path) {
  const base = getAppBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
