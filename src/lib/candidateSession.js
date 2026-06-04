import { prisma } from "./prisma";
import { calculateTimeRemaining } from "./timeValidation";
import { computeTypingScore } from "./typingScore";
import { createLog, ACTION_TYPES } from "./activityLog.js";

class CandidateSessionManager {
  constructor() {
    this.activeSessions = new Map();
  }

  // Create a new candidate session (for session management only, not for actual interviews)
  async createSession(
    candidateId,
    accessKey,
    userAgent,
    ipAddress,
    candidateEmail
  ) {
    try {
      // Check if candidate already has an active session
      const existingSession = await prisma.candidateSession.findFirst({
        where: {
          accessKey: accessKey,
          status: { in: ["STARTED", "IN_PROGRESS"] },
        },
      });

      if (existingSession) {
        // Return existing session instead of creating new one
        this.activeSessions.set(candidateId, {
          sessionId: existingSession.id,
          accessKey: accessKey,
          startedAt: existingSession.startedAt,
          userAgent: userAgent,
          ipAddress: ipAddress,
        });
        return existingSession;
      }

      // For session management, we don't need to create a database record
      // Just store in memory for quick access
      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      this.activeSessions.set(candidateId, {
        sessionId: sessionId,
        accessKey: accessKey,
        startedAt: new Date(),
        userAgent: userAgent,
        ipAddress: ipAddress,
      });

      // Return a mock session object for compatibility
      return {
        id: sessionId,
        accessKey: accessKey,
        status: "STARTED",
        startedAt: new Date(),
      };
    } catch (error) {
      console.error("Error creating candidate session:", error);
      throw error;
    }
  }

  // Verify candidate session
  async verifySession(candidateId, accessKey) {
    try {
      // Check memory first for quick validation
      const memorySession = this.activeSessions.get(candidateId);
      if (memorySession && memorySession.accessKey === accessKey) {
        return { valid: true, session: memorySession };
      }

      // If no memory session, check database for any active session
      const session = await prisma.candidateSession.findFirst({
        where: {
          accessKey: accessKey,
          status: { in: ["STARTED", "IN_PROGRESS"] },
        },
        orderBy: { startedAt: "desc" },
      });

      if (!session) {
        return { valid: false, reason: "No active session found" };
      }

      // Check if session is expired (24 hours)
      const now = new Date();
      const sessionAge = now.getTime() - session.startedAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge > maxAge) {
        // Session expired - do not change status, just remove from memory
        this.activeSessions.delete(candidateId);
        return { valid: false, reason: "Session expired" };
      }

      // Update memory cache for future quick access
      this.activeSessions.set(candidateId, {
        sessionId: session.id,
        accessKey: accessKey,
        startedAt: session.startedAt,
      });

      return { valid: true, session: session };
    } catch (error) {
      console.error("Error verifying candidate session:", error);
      return { valid: false, reason: "Session verification failed" };
    }
  }

  // Deactivate session
  async deactivateSession(candidateId, accessKey) {
    try {
      // Remove from memory only - do not change database status
      this.activeSessions.delete(candidateId);

      console.log(
        `Session deactivated for candidate ${candidateId} with access key ${accessKey} - status preserved`
      );
    } catch (error) {
      console.error("Error deactivating candidate session:", error);
    }
  }

  // Check if candidate is suspended
  async isCandidateSuspended(candidateId) {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { isActive: true },
      });

      return !candidate?.isActive;
    } catch (error) {
      console.error("Error checking candidate suspension:", error);
      return false;
    }
  }

  // Clean up expired sessions (old abandoned ones → ABANDONED)
  async cleanupExpiredSessions() {
    try {
      const expiredTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago (more conservative)

      // Only set ABANDONED for sessions that are truly old and inactive
      // This is more conservative - only sessions older than 7 days get marked as ABANDONED
      await prisma.candidateSession.updateMany({
        where: {
          status: { in: ["STARTED", "IN_PROGRESS"] },
          startedAt: { lt: expiredTime },
        },
        data: { status: "ABANDONED" },
      });

      // Clear expired sessions from memory
      for (const [candidateId, session] of this.activeSessions.entries()) {
        if (session.startedAt < expiredTime) {
          this.activeSessions.delete(candidateId);
        }
      }

      console.log(`Cleaned up sessions older than 7 days`);
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
    }
  }

  /**
   * Auto-complete IN_PROGRESS attempts whose interview time has expired (user left, battery died, etc.).
   * Uses only attempt time (startedAt + interview.durationMinutes), NOT session/idle expiry.
   * So if session expires in 5 min but interview is 60 min, they can resume with remaining time.
   * Uses existing CandidateAnswer data (e.g. from periodic save) to compute score when available.
   */
  async completeExpiredAttempts() {
    try {
      const inProgress = await prisma.candidateSession.findMany({
        where: { status: "IN_PROGRESS" },
        include: {
          interview: {
            include: { questions: true },
          },
          candidateAnswers: { include: { question: true } },
        },
      });

      let completedCount = 0;
      for (const attempt of inProgress) {
        const timeData = calculateTimeRemaining(
          attempt.startedAt,
          attempt.interview.durationMinutes
        );
        if (!timeData.isExpired) continue;
        completedCount += 1;

        const isTyping = attempt.interview.type === "TYPING";
        let score = 0;
        let answeredCount = 0;

        if (isTyping && attempt.interview.questions[0]) {
          const question = attempt.interview.questions[0];
          const answer = attempt.candidateAnswers.find(
            (a) => a.questionId === question.id
          );
          if (answer && (answer.typingStats || answer.answer != null)) {
            const typingStats =
              typeof answer.typingStats === "object"
                ? answer.typingStats
                : {};
            const { score: typingScore, isPassing } = computeTypingScore(
              typingStats,
              question.points
            );
            score = typingScore;
            answeredCount = 1;
            await prisma.candidateAnswer.updateMany({
              where: {
                sessionId: attempt.id,
                questionId: question.id,
              },
              data: { isCorrect: isPassing },
            });
          }
        } else {
          const questionsOrdered = [...attempt.interview.questions].sort(
            (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
          );
          for (const q of questionsOrdered) {
            const ans = attempt.candidateAnswers.find(
              (a) => a.questionId === q.id
            );
            if (ans && ans.answer != null && String(ans.answer).trim() !== "") {
              answeredCount++;
              if (ans.isCorrect) score += q.points ?? 0;
            }
          }
        }

        await prisma.candidateSession.update({
          where: { id: attempt.id },
          data: {
            status: "COMPLETED",
            completedAt: timeData.serverNow,
            submissionReason: "TIME_UP",
            score,
            answeredQuestions: answeredCount,
          },
        });

        await createLog({
          actorType: "SYSTEM",
          actorName: "System",
          actorEmail: null,
          actorRole: "SYSTEM",
          actionType: ACTION_TYPES.CANDIDATE_INTERVIEW_SUBMITTED,
          resource: "interview",
          description: `Attempt ${attempt.id} auto-completed (time expired). Candidate: ${attempt.candidateName}. Score: ${score}.`,
          targetInterviewId: attempt.interviewId,
          targetInterviewType: attempt.interview?.type ?? null,
        });
      }

      if (completedCount > 0) {
        console.log(
          `Auto-completed ${completedCount} expired IN_PROGRESS attempt(s)`
        );
      }
    } catch (error) {
      console.error("Error completing expired attempts:", error);
    }
  }
}

// Create singleton instance
const candidateSessionManager = new CandidateSessionManager();

// Clean up expired sessions every hour
setInterval(() => {
  candidateSessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Auto-complete IN_PROGRESS attempts whose interview time has expired (e.g. user left / battery died). Run every 2 minutes.
setInterval(() => {
  candidateSessionManager.completeExpiredAttempts();
}, 2 * 60 * 1000);

export default candidateSessionManager;
