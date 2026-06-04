import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/candidate/attempt-results
 * Returns detailed results for the candidate's completed attempts (when cohort results are published).
 * Does NOT include correct answers to avoid copying.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { candidateId, accessKey } = body;

    if (!candidateId || !accessKey) {
      return NextResponse.json(
        { success: false, error: "candidateId and accessKey are required" },
        { status: 400 }
      );
    }

    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { accessKey, candidateId, status: "ENROLLED" },
      select: { cohortId: true },
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: "Enrollment not found" },
        { status: 404 }
      );
    }

    const cohortId = enrollment.cohortId;

    // Only allow when cohort results are published
    let resultsPublished = false;
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT results_published FROM cohorts WHERE id = ? LIMIT 1",
        cohortId
      );
      const row = rows?.[0];
      if (row) {
        const val = row.results_published ?? row.Results_Published;
        resultsPublished = typeof val === "number" ? val !== 0 : Boolean(val);
      }
    } catch (_) {}
    if (!resultsPublished) {
      return NextResponse.json(
        { success: false, error: "Results are not published for this cohort" },
        { status: 403 }
      );
    }

    const cohortInterviews = await prisma.cohortInterview.findMany({
      where: { cohortId },
      select: { interviewId: true },
    });
    const interviewIds = cohortInterviews.map((ci) => ci.interviewId);
    if (interviewIds.length === 0) {
      return NextResponse.json({ success: true, attempts: [] });
    }

    const sessions = await prisma.candidateSession.findMany({
      where: {
        accessKey,
        interviewId: { in: interviewIds },
        status: "COMPLETED",
      },
      include: {
        interview: { select: { id: true, type: true, durationMinutes: true } },
        candidateAnswers: {
          orderBy: { answeredAt: "asc" },
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                questionType: true,
                points: true,
                orderIndex: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: "asc" },
    });

    const attempts = sessions.map((session) => {
      const startedAt = session.startedAt;
      const completedAt = session.completedAt;
      const durationSeconds =
        startedAt && completedAt
          ? Math.round((new Date(completedAt) - new Date(startedAt)) / 1000)
          : null;

      const isTyping = session.interview?.type === "TYPING";
      const typingAnswer = session.candidateAnswers.find((ca) => ca.typingStats);
      const attemptTypingStats = typingAnswer?.typingStats ?? null;

      const questions = session.candidateAnswers.map((ca) => ({
        questionId: ca.question.id,
        orderIndex: ca.question.orderIndex ?? 0,
        questionText: ca.question.questionText,
        questionType: ca.question.questionType,
        points: ca.question.points ?? 1,
        yourAnswer: ca.answer ?? "",
        pointsEarned: isTyping && ca.typingStats
          ? (session.score ?? 0)
          : (ca.isCorrect ? (ca.question.points ?? 1) : 0),
        answeredAt: ca.answeredAt,
        typingStats: ca.typingStats ?? null,
      }));

      return {
        sessionId: session.id,
        interviewId: session.interviewId,
        interviewType: session.interview?.type ?? "UNKNOWN",
        durationMinutes: session.interview?.durationMinutes ?? null,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationSeconds,
        score: session.score,
        totalQuestions: session.totalQuestions,
        answeredQuestions: session.answeredQuestions,
        submissionReason: session.submissionReason ?? null,
        typingStats: attemptTypingStats,
        questions,
      };
    });

    return NextResponse.json({ success: true, attempts });
  } catch (error) {
    console.error("Error fetching attempt results:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load results" },
      { status: 500 }
    );
  }
}
