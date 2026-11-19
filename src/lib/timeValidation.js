/**
 * Server-side time validation utilities
 * Ensures all time calculations use server time to prevent client manipulation
 *
 * WHERE THE SYSTEM READS TIME FROM
 * - Server: All authoritative timing (attempt start/end, expiry, submission checks) uses
 *   the machine running the Node.js app (new Date() in API routes and this module).
 *   That is typically the host/VM system clock. Keep the server clock correct (e.g. NTP).
 *
 * - Client: The candidate's browser uses its own system clock for:
 *   - Countdown display: now synced with server every 30s via /api/candidate/check-time
 *   - Initial time remaining: taken from server (start-attempt and resume-attempt return
 *     server-calculated timeRemaining), so a wrong client clock no longer skews the timer.
 *   - Cohort open/close on the welcome page: still client local time for display; starting
 *     an attempt is validated by the server (enrollment/cohort active checks).
 *
 * EFFECT OF WRONG CLIENT CLOCK (after our changes)
 * - Attempt timer: Initial value and periodic sync come from the server, so the displayed
 *   countdown stays correct. When the client hits 0 it may submit; the server always
 *   re-validates with server time and rejects or marks completed if expired.
 * - Submissions: Accept/reject and completedAt are always determined by server time.
 * - Cohort “open/closed” on welcome: Display can be wrong if client clock is off; actual
 *   ability to start is enforced server-side when starting an attempt.
 */

/**
 * Calculate time remaining for an attempt using server time
 * @param {Date} startedAt - When the attempt started
 * @param {number} durationMinutes - Duration in minutes
 * @returns {object} Time calculation results
 */
export function calculateTimeRemaining(startedAt, durationMinutes) {
  const serverNow = new Date();
  const timeElapsed = Math.floor(
    (serverNow.getTime() - startedAt.getTime()) / 1000
  );
  const timeRemaining = durationMinutes * 60 - timeElapsed;

  return {
    serverNow,
    timeElapsed,
    timeRemaining: Math.max(0, timeRemaining), // Never return negative
    isExpired: timeRemaining <= 0,
  };
}

/**
 * Validate if an attempt is still valid (not expired)
 * @param {Date} startedAt - When the attempt started
 * @param {number} durationMinutes - Duration in minutes
 * @returns {boolean} True if attempt is still valid
 */
export function isAttemptValid(startedAt, durationMinutes) {
  const { isExpired } = calculateTimeRemaining(startedAt, durationMinutes);
  return !isExpired;
}

/**
 * Get server time for client synchronization
 * @returns {object} Server time information
 */
export function getServerTime() {
  const serverNow = new Date();
  return {
    serverTime: serverNow.getTime(),
    serverTimeISO: serverNow.toISOString(),
    timestamp: Math.floor(serverNow.getTime() / 1000),
  };
}

/**
 * Log time validation for security monitoring
 * @param {string} attemptId - Attempt ID
 * @param {object} timeData - Time calculation data
 * @param {string} action - Action being performed
 */
export function logTimeValidation(attemptId, timeData, action) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[TIME_VALIDATION] ${action} for attempt ${attemptId}:`, {
    serverTime: timeData.serverNow.toISOString(),
    timeElapsed: timeData.timeElapsed,
    timeRemaining: timeData.timeRemaining,
    isExpired: timeData.isExpired,
  });
}
