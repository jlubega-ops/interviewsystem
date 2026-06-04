/**
 * Session idle timeout: log out after this many ms of no activity.
 * Activity = any request that hits the auth middleware or /api/auth/verify.
 */
export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
