import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireEnrollment } from "../../../../lib/candidateAuth";
import { readCohortResultFlags } from "../../../../lib/resultsPublish";
import { resolveCorrectLetter, normalizeOptionLetter } from "../../../../lib/questionOptions";
import { htmlToPlainText } from "../../../../lib/sanitize";

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

    const owned = await requireEnrollment({ candidateId, accessKey });
    if (owned.error) return owned.error;

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
    const resultFlags = await readCohortResultFlags(prisma, cohortId);
    if (!resultFlags.resultsPublished) {
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
        interview: {
          select: {
            id: true,
            type: true,
            durationMinutes: true,
            questions: {
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                questionText: true,
                questionType: true,
                points: true,
                orderIndex: true,
                options: true,
                correctAnswer: true,
              },
            },
          },
        },
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
                options: true,
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

      const answersByQuestion = new Map(
        session.candidateAnswers.map((ca) => [ca.questionId, ca])
      );
      const interviewQuestions = session.interview?.questions || [];
      const totalPoints = interviewQuestions.reduce(
        (sum, question) => sum + (question.points ?? 0),
        0
      );
      const questions = resultFlags.resultsShowAttempt
        ? (interviewQuestions.length
            ? interviewQuestions
            : session.candidateAnswers.map((ca) => ca.question)
          ).map((question) => {
            const ca = answersByQuestion.get(question.id);
            const answered = ca?.answer != null && String(ca.answer).trim() !== "";
            const questionOptions = Array.isArray(question.options)
              ? question.options
              : [];
            const isChoiceType =
              question.questionType === "MULTIPLE_CHOICE" ||
              question.questionType === "TRUE_FALSE";
            const yourLetter =
              isChoiceType && answered ? normalizeOptionLetter(ca?.answer) : "";
            const yourOption = yourLetter
              ? questionOptions.find(
                  (opt) => normalizeOptionLetter(opt?.letter) === yourLetter
                )
              : null;
            const yourAnswerText = yourOption
              ? htmlToPlainText(yourOption?.text || "")
              : "";
            const payload = {
              questionId: question.id,
              orderIndex: question.orderIndex ?? 0,
              questionText: question.questionText,
              questionType: question.questionType,
              points: question.points ?? 1,
              options: Array.isArray(question.options) ? question.options : [],
              yourAnswer: answered ? ca.answer ?? "" : "",
              yourAnswerText: answered ? yourAnswerText || String(ca.answer ?? "") : "",
              unanswered: !answered,
              pointsEarned: !answered
                ? 0
                : isTyping && ca.typingStats
                  ? (session.score ?? 0)
                  : (ca.isCorrect ? (question.points ?? 1) : 0),
              answeredAt: ca?.answeredAt ?? null,
              typingStats: ca?.typingStats ?? null,
            };
            if (resultFlags.resultsShowCorrect) {
              payload.correctAnswer = resolveCorrectLetter(question);
              payload.isCorrect = answered ? Boolean(ca.isCorrect) : false;
            }
            return payload;
          })
        : [];

      return {
        sessionId: session.id,
        interviewId: session.interviewId,
        interviewType: session.interview?.type ?? "UNKNOWN",
        durationMinutes: session.interview?.durationMinutes ?? null,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationSeconds,
        score: session.score,
        totalQuestions: interviewQuestions.length || session.totalQuestions,
        totalPoints,
        answeredQuestions: session.answeredQuestions,
        submissionReason: session.submissionReason ?? null,
        typingStats: attemptTypingStats,
        questions,
      };
    });

    return NextResponse.json({
      success: true,
      attempts,
      ...resultFlags,
    });
  } catch (error) {
    console.error("Error fetching attempt results:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load results" },
      { status: 500 }
    );
  }
}
