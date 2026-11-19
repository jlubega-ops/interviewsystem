import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  calculateTimeRemaining,
  logTimeValidation,
} from "../../../../lib/timeValidation";
import { questionsForCandidate, requireEnrollment } from "../../../../lib/candidateAuth";
import { getInterviewWithQuestions } from "../../../../lib/cachedReads";
import { applyAttemptShuffle } from "../../../../lib/attemptShuffle";

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

    const owned = await requireEnrollment({ candidateId, accessKey });
    if (owned.error) return owned.error;

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
    });
    const interview = attempt ? await getInterviewWithQuestions(attempt.interviewId) : null;

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
    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    const timeData = calculateTimeRemaining(
      attempt.startedAt,
      interview.durationMinutes
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

    const finalQuestions = applyAttemptShuffle(
      interview.questions,
      attempt.shuffleLayout
    );

    // Answers are stored as the option identity (canonical letter), not the on-screen A/B/C/D.
    const answers = {};
    existingAnswers.forEach((entry) => {
      const raw = (entry.answer || "").toString().trim();
      const upper = raw.toUpperCase();
      const question = finalQuestions.find((q) => q.id === entry.questionId);
      if (!question || !Array.isArray(question.options)) {
        answers[entry.questionId] = raw;
        return;
      }
      const byLetter = question.options.find(
        (opt) =>
          opt &&
          typeof opt.letter === "string" &&
          opt.letter.trim().toUpperCase() === upper
      );
      if (byLetter) {
        answers[entry.questionId] = byLetter.letter.trim().toUpperCase();
        return;
      }
      if (!attempt.shuffleLayout && /^[A-D]$/i.test(upper)) {
        const idx = upper.charCodeAt(0) - 65;
        const opt = question.options[idx];
        if (opt && typeof opt.letter === "string" && opt.letter.trim() !== "") {
          answers[entry.questionId] = opt.letter.trim().toUpperCase();
          return;
        }
      }
      answers[entry.questionId] = raw;
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      questions: questionsForCandidate(finalQuestions),
      durationMinutes: interview.durationMinutes,
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
