/**
 * Submission reason codes and human-readable labels for candidate attempts.
 * Used on candidate attempt view and admin results.
 */
export const SUBMISSION_REASONS = {
  TIME_UP: "Time expired",
  SELF_SUBMITTED: "Student submitted",
  LEFT_APPLICATION: "Left exam (tab/window or application)",
  BROWSER_CLOSED: "Browser or tab closed",
  SESSION_EXPIRED: "Session expired",
};

/**
 * @param {string | null | undefined} code
 * @returns {string}
 */
export function getSubmissionReasonLabel(code) {
  if (!code || typeof code !== "string") return "—";
  const key = code.trim().toUpperCase();
  return SUBMISSION_REASONS[key] || code;
}
