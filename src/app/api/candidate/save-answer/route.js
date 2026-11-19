import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireOwnedAttempt } from "../../../../lib/candidateAuth";

export const runtime = "nodejs";

// POST /api/candidate/save-answer - Save individual answer
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { attemptId, questionId, answer, typingStats, accessKey, candidateId } = body;

    if (!attemptId || !questionId || answer === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const owned = await requireOwnedAttempt({
      attemptId,
      accessKey,
      candidateId,
      requireInProgress: true,
    });
    if (owned.error) return owned.error;

    const question = await prisma.question.findFirst({
      where: {
        id: String(questionId),
        interviewId: owned.attempt.interviewId,
      },
      select: { id: true },
    });
    if (!question) {
      return NextResponse.json(
        { success: false, error: "Invalid question" },
        { status: 400 }
      );
    }

    const existingAnswer = await prisma.candidateAnswer.findFirst({
      where: {
        sessionId: owned.attempt.id,
        questionId: question.id,
      },
    });

    const answerData = {
      answer: answer,
      isCorrect: false,
    };

    if (typingStats) {
      answerData.typingStats = typingStats;
    }

    if (existingAnswer) {
      await prisma.candidateAnswer.update({
        where: { id: existingAnswer.id },
        data: answerData,
      });
    } else {
      await prisma.candidateAnswer.create({
        data: {
          sessionId: owned.attempt.id,
          questionId: question.id,
          ...answerData,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Answer saved successfully",
    });
  } catch (error) {
    console.error("Error saving answer:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save answer",
      },
      { status: 500 }
    );
  }
}
