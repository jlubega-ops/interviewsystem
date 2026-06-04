import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { verifySession } from "../../../../../middleware/auth";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

export const runtime = "nodejs";

/**
 * Map Net WPM to a 0–100% speed score (same as submit-attempt).
 * Typing score = 60% accuracy + 40% speed, then scaled to question points.
 */
function speedScoreFromWpm(netWpm) {
  const wpm = Math.max(0, Number(netWpm) || 0);
  if (wpm < 40) return Math.min(70, Math.round((wpm / 40) * 70));
  if (wpm < 50) return 70;
  if (wpm < 60) return 80;
  if (wpm < 75) return 90;
  return 100;
}

function typingPointsEarned(typingStats, questionPoints) {
  if (!typingStats || questionPoints == null) return 0;
  const accuracyPercent = Math.min(100, Math.max(0, typingStats.accuracy ?? 0));
  const netWpm = typingStats.netWordsPerMinute ?? typingStats.wordsPerMinute ?? 0;
  const speedPercent = speedScoreFromWpm(netWpm);
  const combinedPercent = accuracyPercent * 0.6 + speedPercent * 0.4;
  const points = Math.round((combinedPercent / 100) * questionPoints);
  return Math.min(points, questionPoints);
}

function resolveCorrectToOptionLetter(question) {
  const raw = (question?.correctAnswer ?? "").toString().trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  // If stored as single letter, treat as option.letter
  if (/^[A-Z]$/i.test(upper)) return upper.slice(0, 1);
  // Otherwise try match by option text
  const byText = options.find(
    (opt) =>
      opt &&
      typeof opt.text === "string" &&
      opt.text.trim().toLowerCase() === raw.toLowerCase()
  );
  if (byText && typeof byText.letter === "string") {
    return byText.letter.trim().toUpperCase();
  }
  return upper.slice(0, 1);
}

// GET /api/interviews/[id]/results - Get interview results for a specific interview
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Get user info from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const userEmail = request.headers.get("x-user-email");

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to view results
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get interview with questions and cohort
    const interview = await prisma.interview.findUnique({
      where: { id: id },
      include: {
        cohortInterviews: {
          include: {
            cohort: true,
          },
        },
        questions: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get all attempts for this interview (all statuses)
    const attempts = await prisma.candidateSession.findMany({
      where: {
        interviewId: id,
      },
      include: {
        candidateAnswers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    // Format results data
    const results = attempts.map((attempt) => {
      const startTime = attempt.startedAt;
      const endTime = attempt.completedAt;
      const duration = endTime
        ? Math.round((endTime - startTime) / (1000 * 60))
        : 0; // Duration in minutes

      // Get typing stats for typing interviews
      const typingAnswer = attempt.candidateAnswers.find(
        (answer) => answer.typingStats
      );
      const typingStats = typingAnswer?.typingStats || {};

      // Calculate correct values (answered = questions the candidate actually selected/ticked an answer for)
      const totalQuestions = interview.questions.length;
      const isTypingInterview = interview.type === "TYPING";
      const answeredQuestions = isTypingInterview
        ? attempt.candidateAnswers.length
        : attempt.candidateAnswers.filter(
            (ca) =>
              ca.answer != null && String(ca.answer).trim() !== ""
          ).length;
      const totalPoints = interview.questions.reduce(
        (sum, q) => sum + q.points,
        0
      );

      // For typing interviews, score = 60% accuracy + 40% speed (WPM), scaled to points
      const calculatedScore = isTypingInterview
        ? attempt.candidateAnswers.reduce((sum, answer) => {
            return sum + typingPointsEarned(answer.typingStats, answer.question.points);
          }, 0)
        : attempt.candidateAnswers.reduce((sum, answer) => {
            return sum + (answer.isCorrect ? answer.question.points : 0);
          }, 0);

      return {
        attemptId: attempt.id,
        candidateName: attempt.candidateName,
        candidateEmail: attempt.candidateEmail,
        accessKey: attempt.accessKey,
        status: attempt.status,
        submissionReason: attempt.submissionReason ?? null,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        score: calculatedScore,
        totalQuestions: totalQuestions,
        answeredQuestions: answeredQuestions,
        totalPoints: totalPoints,
        typingStats: typingStats,
        // Show canonical option letters (A/B/C/D) so results match the question-set view (green = correct).
        questions: [...attempt.candidateAnswers]
          .sort(
            (a, b) =>
              (a.question?.orderIndex ?? 0) - (b.question?.orderIndex ?? 0)
          )
          .map((answer, index) => {
          const pointsEarned = isTypingInterview && answer.typingStats
            ? typingPointsEarned(answer.typingStats, answer.question.points)
            : (answer.isCorrect ? answer.question.points : 0);
          const correctOptionLetter = resolveCorrectToOptionLetter(answer.question);
          const candidateLetter =
            interview.type === "TYPING"
              ? answer.answer
              : (answer.answer && String(answer.answer).trim().toUpperCase().slice(0, 1)) || "";
          const correctLetter =
            interview.type === "TYPING"
              ? "N/A (Typing Test)"
              : correctOptionLetter;
          return {
            questionNumber: index + 1,
            questionText: answer.question.questionText,
            userAnswer: answer.answer,
            candidateAnswer: candidateLetter,
            correctAnswer: correctLetter,
            isCorrect: answer.isCorrect,
            points: answer.question.points,
            pointsEarned,
            typingStats: answer.typingStats,
          };
        }),
      };
    });

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_RESULTS,
      resource: "interview",
      description: `Viewed results for ${interview.type} interview (ID: ${id}), ${attempts.length} attempts`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        interview: {
          id: interview.id,
          type: interview.type,
          duration: interview.durationMinutes,
          instructions: interview.instructions,
          cohort: interview.cohortInterviews?.[0]?.cohort
            ? {
                id: interview.cohortInterviews[0].cohort.id,
                name: interview.cohortInterviews[0].cohort.name,
              }
            : null,
        },
        results,
      },
    });
  } catch (error) {
    console.error("Error fetching interview results:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
