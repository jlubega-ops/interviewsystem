import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export function questionsForCandidate(questions = []) {
  return questions.map((q, index) => ({
    id: q.id,
    interviewId: q.interviewId,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options,
    points: q.points,
    orderIndex: q.orderIndex ?? index + 1,
    createdAt: q.createdAt,
  }));
}

export async function requireEnrollment({ candidateId, accessKey }) {
  if (!accessKey || typeof accessKey !== "string") {
    return {
      enrollment: null,
      error: NextResponse.json(
        { success: false, error: "Access key is required" },
        { status: 400 }
      ),
    };
  }

  const enrollment = await prisma.cohortEnrollment.findFirst({
    where: {
      accessKey: accessKey.trim(),
      ...(candidateId ? { candidateId } : {}),
      status: "ENROLLED",
    },
    include: {
      candidate: {
        select: { id: true, isActive: true, fullName: true, email: true },
      },
    },
  });

  if (!enrollment || !enrollment.candidate?.isActive) {
    return {
      enrollment: null,
      error: NextResponse.json(
        { success: false, error: "Invalid access" },
        { status: 403 }
      ),
    };
  }

  if (candidateId && enrollment.candidateId !== candidateId) {
    return {
      enrollment: null,
      error: NextResponse.json(
        { success: false, error: "Invalid access" },
        { status: 403 }
      ),
    };
  }

  return { enrollment, error: null };
}

export async function requireOwnedAttempt({
  attemptId,
  accessKey,
  candidateId,
  requireInProgress = false,
}) {
  if (!attemptId || !accessKey) {
    return {
      attempt: null,
      enrollment: null,
      error: NextResponse.json(
        { success: false, error: "Attempt ID and access key are required" },
        { status: 400 }
      ),
    };
  }

  const owned = await requireEnrollment({ candidateId, accessKey });
  if (owned.error) return { attempt: null, enrollment: null, error: owned.error };

  const attempt = await prisma.candidateSession.findUnique({
    where: { id: String(attemptId) },
  });

  if (!attempt || attempt.accessKey !== accessKey.trim()) {
    return {
      attempt: null,
      enrollment: owned.enrollment,
      error: NextResponse.json(
        { success: false, error: "Invalid access" },
        { status: 403 }
      ),
    };
  }

  if (requireInProgress && attempt.status !== "IN_PROGRESS") {
    return {
      attempt,
      enrollment: owned.enrollment,
      error: NextResponse.json(
        { success: false, error: "Attempt is not in progress" },
        { status: 400 }
      ),
    };
  }

  return { attempt, enrollment: owned.enrollment, error: null };
}
