import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  calculateTimeRemaining,
  logTimeValidation,
} from "../../../../lib/timeValidation";

export const runtime = "nodejs";

// POST /api/candidate/resume-attempt - Resume an existing interview attempt
export async function POST(request) {
  try {
    const { candidateId, accessKey, interviewId } = await request.json();

    console.log("Resume attempt API called with:", {
      candidateId,
      accessKey,
      interviewId,
    });

    if (!candidateId || !accessKey || !interviewId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // First, let's check what attempts exist for this accessKey and interviewId
    const allAttempts = await prisma.candidateSession.findMany({
      where: {
        accessKey: accessKey,
        interviewId: interviewId,
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    console.log("All attempts for resume check:", {
      accessKey,
      interviewId,
      allAttempts: allAttempts.map((a) => ({
        id: a.id,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      })),
    });

    // Find existing IN_PROGRESS attempt
    const attempt = await prisma.candidateSession.findFirst({
      where: {
        accessKey: accessKey,
        interviewId: interviewId,
        status: "IN_PROGRESS",
      },
      include: {
        interview: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    console.log("Resume attempt check:", {
      accessKey,
      interviewId,
      foundAttempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.startedAt,
          }
        : null,
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "No active attempt found" },
        { status: 404 }
      );
    }

    // Check if attempt is expired using server time
    const timeData = calculateTimeRemaining(
      attempt.startedAt,
      attempt.interview.durationMinutes
    );

    // Log for security monitoring
    logTimeValidation(attempt.id, timeData, "RESUME_ATTEMPT");

    if (timeData.isExpired) {
      // Time's up - mark as completed
      await prisma.candidateSession.update({
        where: { id: attempt.id },
        data: {
          status: "COMPLETED",
          completedAt: timeData.serverNow,
          submissionReason: "TIME_UP",
        },
      });

      return NextResponse.json(
        { success: false, error: "Time has expired" },
        { status: 400 }
      );
    }

    // Return server time for accurate client-side calculation
    const serverTime = timeData.serverNow.getTime();

    // Get existing answers
    const existingAnswers = await prisma.candidateAnswer.findMany({
      where: { sessionId: attempt.id },
      select: { questionId: true, answer: true },
    });

    // Questions and options in original order (no shuffle).
    const finalQuestions = attempt.interview.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(JSON.stringify(q.options)) : [],
    }));

    // Build answers: use stored option.letter; legacy A–D by position = options[idx].letter.
    const answers = {};
    existingAnswers.forEach((entry) => {
      const raw = (entry.answer || "").toString().trim();
      const upper = raw.toUpperCase();
      const question = finalQuestions.find((q) => q.id === entry.questionId);
      if (!question || !Array.isArray(question.options)) {
        answers[entry.questionId] = raw;
        return;
      }
      if (/^[A-D]$/i.test(upper)) {
        const idx = upper.charCodeAt(0) - 65;
        const opt = question.options[idx];
        if (opt && typeof opt.letter === "string" && opt.letter.trim() !== "") {
          answers[entry.questionId] = opt.letter.trim().toUpperCase();
          return;
        }
      }
      const byLetter = question.options.find(
        (opt) =>
          opt &&
          typeof opt.letter === "string" &&
          opt.letter.trim().toUpperCase() === upper
      );
      answers[entry.questionId] = byLetter
        ? byLetter.letter.trim().toUpperCase()
        : raw;
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      questions: finalQuestions,
      durationMinutes: attempt.interview.durationMinutes,
      startedAt: attempt.startedAt,
      timeRemaining: timeData.timeRemaining,
      answers: answers,
      serverTime: serverTime,
      leaveAttempts: attempt.leaveAttempts, // Return current leave attempts
    });
  } catch (error) {
    console.error("Error resuming attempt:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resume interview attempt",
      },
      { status: 500 }
    );
  }
}
