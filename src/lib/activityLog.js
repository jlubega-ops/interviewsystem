/**
 * Activity logging for audit trail. All user and candidate actions are logged here.
 */
import { prisma } from "./prisma";

export const ACTION_TYPES = {
  // Auth - User
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_SUSPENDED: "LOGIN_SUSPENDED",
  LOGIN_NOT_ACTIVATED: "LOGIN_NOT_ACTIVATED",
  LOGOUT: "LOGOUT",

  // Cohorts
  VIEW_COHORTS: "VIEW_COHORTS",
  VIEW_COHORT: "VIEW_COHORT",
  CREATE_COHORT: "CREATE_COHORT",
  EDIT_COHORT: "EDIT_COHORT",
  DELETE_COHORT: "DELETE_COHORT",
  ASSIGN_EXAMINER: "ASSIGN_EXAMINER",
  UNASSIGN_EXAMINER: "UNASSIGN_EXAMINER",

  // Interviews (within cohort context)
  CREATE_INTERVIEW: "CREATE_INTERVIEW",
  DELETE_INTERVIEW: "DELETE_INTERVIEW",
  VIEW_INTERVIEW: "VIEW_INTERVIEW",
  ASSIGN_CANDIDATE: "ASSIGN_CANDIDATE",
  UNASSIGN_CANDIDATE: "UNASSIGN_CANDIDATE",
  UPLOAD_CANDIDATES: "UPLOAD_CANDIDATES",
  VIEW_RESULTS: "VIEW_RESULTS",
  VIEW_ATTEMPTS: "VIEW_ATTEMPTS",
  EXPORT_ATTEMPTS: "EXPORT_ATTEMPTS",
  DELETE_ATTEMPT: "DELETE_ATTEMPT",
  TOGGLE_INTERVIEW_VISIBILITY: "TOGGLE_INTERVIEW_VISIBILITY",

  // Users (admin)
  VIEW_USERS: "VIEW_USERS",
  VIEW_USER: "VIEW_USER",
  CREATE_USER: "CREATE_USER",
  EDIT_USER: "EDIT_USER",
  DELETE_USER: "DELETE_USER",
  SUSPEND_USER: "SUSPEND_USER",
  UNSUSPEND_USER: "UNSUSPEND_USER",
  RESEND_ACTIVATION: "RESEND_ACTIVATION",
  RESET_PASSWORD_EMAIL: "RESET_PASSWORD_EMAIL",

  // Profile
  VIEW_PROFILE: "VIEW_PROFILE",
  UPDATE_PROFILE: "UPDATE_PROFILE",

  // Candidate (student) actions
  CANDIDATE_VIEW_HOME: "CANDIDATE_VIEW_HOME",
  CANDIDATE_LOGIN_SUCCESS: "CANDIDATE_LOGIN_SUCCESS",
  CANDIDATE_LOGIN_FAILED: "CANDIDATE_LOGIN_FAILED",
  CANDIDATE_INVALID_KEY: "CANDIDATE_INVALID_KEY",
  CANDIDATE_LOGOUT: "CANDIDATE_LOGOUT",
  CANDIDATE_STARTED_INTERVIEW: "CANDIDATE_STARTED_INTERVIEW",
  CANDIDATE_INTERVIEW_START_FAILED: "CANDIDATE_INTERVIEW_START_FAILED",
  CANDIDATE_INTERVIEW_SUBMITTED: "CANDIDATE_INTERVIEW_SUBMITTED",
  CANDIDATE_LEFT_SCREEN: "CANDIDATE_LEFT_SCREEN",
  CANDIDATE_HIDDEN_INTERVIEW: "CANDIDATE_HIDDEN_INTERVIEW",
  CANDIDATE_VIEW_ATTEMPTS: "CANDIDATE_VIEW_ATTEMPTS",

  // Logs & Reports (admin)
  VIEW_LOG_DETAIL: "VIEW_LOG_DETAIL",
  VIEW_REPORTS: "VIEW_REPORTS",
};

/**
 * Create an activity log entry. Fires and forgets (does not throw).
 * @param {Object} opts
 * @param {"USER"|"CANDIDATE"} opts.actorType
 * @param {string} [opts.userId] - User ID (for USER actor)
 * @param {string} [opts.actorName] - Display name (user fullName or candidate name)
 * @param {string} [opts.actorEmail] - Email
 * @param {string} [opts.actorOrg] - Organisation (users only)
 * @param {string} [opts.actorRole] - ADMIN, EXAMINER, CANDIDATE, etc.
 * @param {string} opts.actionType - One of ACTION_TYPES
 * @param {string} [opts.resource] - e.g. "cohort", "interview", "user"
 * @param {string} opts.description - Human-readable description of the action
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 * @param {string} [opts.candidateId] - Candidate ID (for CANDIDATE actor)
 * @param {string} [opts.targetCohortId]
 * @param {string} [opts.targetCohortName]
 * @param {string} [opts.targetInterviewId]
 * @param {string} [opts.targetInterviewType]
 */
export async function createLog(opts) {
  try {
    await prisma.activityLog.create({
      data: {
        actorType: opts.actorType ?? "USER",
        userId: opts.userId ?? null,
        actorName: opts.actorName ?? null,
        actorEmail: opts.actorEmail ?? null,
        actorOrg: opts.actorOrg ?? null,
        actorRole: opts.actorRole ?? null,
        actionType: opts.actionType,
        resource: opts.resource ?? null,
        description: opts.description,
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
        candidateId: opts.candidateId ?? null,
        targetCohortId: opts.targetCohortId ?? null,
        targetCohortName: opts.targetCohortName ?? null,
        targetInterviewId: opts.targetInterviewId ?? null,
        targetInterviewType: opts.targetInterviewType ?? null,
      },
    });
  } catch (err) {
    console.error("Activity log write failed:", err?.message || err);
  }
}

/**
 * Helper: get request metadata for logging
 */
export function getRequestMeta(request) {
  const ip =
    request?.headers?.get?.("x-forwarded-for") ||
    request?.headers?.get?.("x-real-ip") ||
    "127.0.0.1";
  const userAgent = request?.headers?.get?.("user-agent") || null;
  return { ipAddress: ip?.split(",")[0]?.trim() || ip, userAgent: userAgent?.substring(0, 500) || null };
}
