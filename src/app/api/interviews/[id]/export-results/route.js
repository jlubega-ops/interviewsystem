import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../lib/apiAuth";
import { prisma } from "../../../../../lib/prisma";
import { getSubmissionReasonLabel } from "../../../../../lib/submissionReasons";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";
import { formatOptionsLine, resolveCorrectLetter } from "../../../../../lib/questionOptions";

export const runtime = "nodejs";

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

// GET /api/interviews/[id]/export-results - Export interview results to Excel
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const auth = await requireApiUser(request, {
      roles: ["ADMIN", "EXAMINER", "SUPERADMIN"],
    });
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const userEmail = auth.user.email;

    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get interview with questions
    const interview = await prisma.interview.findUnique({
      where: { id: id },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get all attempts for this interview
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
        startedAt: "desc",
      },
    });

    // Create CSV content based on interview type
    const isTypingInterview = interview.type === "TYPING";

    const headers = isTypingInterview
      ? [
          "Candidate Name",
          "Email",
          "Access Key",
          "Status",
          "Submission Reason",
          "Start Time",
          "End Time",
          "Duration (minutes)",
          "Total Score",
          "Total Points",
          "Percentage",
          "Net WPM",
          "Accuracy (%)",
          "Words Typed",
          "Characters Typed",
          "Typed Text",
        ]
      : [
          "Candidate Name",
          "Email",
          "Access Key",
          "Status",
          "Submission Reason",
          "Start Time",
          "End Time",
          "Duration (minutes)",
          "Total Score",
          "Total Points",
          "Percentage",
          "Questions Answered",
          "Total Questions",
          ...interview.questions
            .map((q, index) => [
              `Q${index + 1} Question`,
              `Q${index + 1} Options`,
              `Q${index + 1} Student Answer`,
              `Q${index + 1} Correct Answer`,
              `Q${index + 1} Answered`,
              `Q${index + 1} Points`,
              `Q${index + 1} Points Earned`,
              `Q${index + 1} Correct`,
            ])
            .flat(),
        ];

    // Use the same data formatting logic as the results API
    const results = attempts.map((attempt) => {
      const startTime = attempt.startedAt;
      const endTime = attempt.completedAt;
      const duration = endTime
        ? Math.round((endTime - startTime) / (1000 * 60))
        : 0; // Duration in minutes

      // Get typing stats for typing interviews (same logic as results API)
      const typingAnswer = attempt.candidateAnswers.find(
        (answer) => answer.typingStats
      );
      const typingStats = typingAnswer?.typingStats || {};

      const totalQuestions = interview.questions.length;
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
        // Question order: real (orderIndex). Student answer = display letter. Correct answer = as set in question (canonical letter).
        questions: interview.questions.map((question, index) => {
          const answer = attempt.candidateAnswers.find(
            (ca) => ca.questionId === question.id
          );
          const answered =
            answer?.answer != null && String(answer.answer).trim() !== "";
          const pointsEarned = !answered
            ? 0
            : isTypingInterview && answer.typingStats
              ? typingPointsEarned(answer.typingStats, question.points)
              : answer.isCorrect
                ? question.points
                : 0;
          return {
            questionNumber: index + 1,
            questionText: question.questionText,
            options: question.options,
            userAnswer: answer?.answer ?? "",
            candidateAnswer: answer?.answer ?? "",
            correctAnswer: resolveCorrectLetter(question),
            unanswered: !answered,
            isCorrect: answered ? Boolean(answer.isCorrect) : false,
            points: question.points,
            pointsEarned,
            typingStats: answer?.typingStats ?? null,
          };
        }),
      };
    });

    const rows = results.map((result) => {
      const startTime = result.startTime;
      const endTime = result.endTime;
      const duration = result.duration;
      const totalPoints = result.totalPoints;
      const percentage =
        totalPoints > 0 ? Math.round((result.score / totalPoints) * 100) : 0;

      if (isTypingInterview) {
        // For typing interviews, use the same data as the UI
        const typingStats = result.typingStats || {};
        const typedText = result.questions?.[0]?.userAnswer || "";

        return [
          result.candidateName,
          result.candidateEmail,
          result.accessKey,
          result.status,
          getSubmissionReasonLabel(result.submissionReason),
          startTime.toISOString(),
          endTime ? endTime.toISOString() : "",
          duration,
          result.score || 0,
          totalPoints,
          percentage,
          typingStats.netWordsPerMinute ?? typingStats.wordsPerMinute ?? 0,
          typingStats.accuracy || 0,
          typingStats.wordsTyped || 0,
          typingStats.charactersTyped || 0,
          typedText.replace(/"/g, '""'), // Escape quotes for CSV
        ];
      } else {
        // For regular interviews, use the original logic
        const baseRow = [
          result.candidateName,
          result.candidateEmail,
          result.accessKey,
          result.status,
          getSubmissionReasonLabel(result.submissionReason),
          startTime.toISOString(),
          endTime ? endTime.toISOString() : "",
          duration,
          result.score || 0,
          totalPoints,
          percentage,
          result.answeredQuestions || 0,
          interview.questions.length,
        ];

        // Add question-specific data
        const questionRows = result.questions
          .map((question) => {
            return [
              question.questionText.replace(/<[^>]*>/g, ""),
              formatOptionsLine(question.options),
              question.unanswered ? "Not answered" : question.userAnswer || "",
              question.correctAnswer || "",
              question.unanswered ? "No" : "Yes",
              question.points,
              question.pointsEarned,
              question.unanswered ? "No" : question.isCorrect,
            ];
          })
          .flat();

        return [...baseRow, ...questionRows];
      }
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n");

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.EXPORT_ATTEMPTS,
      resource: "interview",
      description: `Exported ${attempts.length} attempts for ${interview.type} interview (ID: ${id}) to CSV`,
      ...getRequestMeta(request),
    });

    // Set response headers for CSV download
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="interview-${id}-results-${
          new Date().toISOString().split("T")[0]
        }.csv"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });

    return response;
  } catch (error) {
    console.error("Error exporting interview results:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export results" },
      { status: 500 }
    );
  }
}
