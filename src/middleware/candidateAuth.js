import candidateSessionManager from "../lib/candidateSession";

export async function verifyCandidateSession(candidateId, accessKey) {
  try {
    // Check if candidate is suspended
    const isSuspended = await candidateSessionManager.isCandidateSuspended(
      candidateId
    );
    if (isSuspended) {
      return {
        valid: false,
        error: "Your access has been suspended. Please contact support.",
        status: 403,
      };
    }

    // Verify session
    const sessionResult = await candidateSessionManager.verifySession(
      candidateId,
      accessKey
    );
    if (!sessionResult.valid) {
      return {
        valid: false,
        error:
          sessionResult.reason === "Session expired"
            ? "Your session has expired. Please log in again."
            : "Invalid session. Please log in again.",
        status: 401,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error verifying candidate session:", error);
    return {
      valid: false,
      error: "Session verification failed. Please try again.",
      status: 500,
    };
  }
}

export function getCandidateFromSession(sessionData) {
  try {
    if (!sessionData) {
      return null;
    }

    const candidateData = JSON.parse(sessionData);
    return candidateData;
  } catch (error) {
    console.error("Error parsing candidate session data:", error);
    return null;
  }
}
