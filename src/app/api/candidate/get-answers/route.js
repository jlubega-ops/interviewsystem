import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireOwnedAttempt } from "../../../../lib/candidateAuth";

export const runtime = "nodejs";

// POST /api/candidate/get-answers - Get saved answers for specific questions
export async function POST(request) {
  try {
    const { attemptId, questionIds, accessKey, candidateId } = await request.json();

    if (!attemptId || !questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const owned = await requireOwnedAttempt({
      attemptId,
      accessKey,
      candidateId,
    });
    if (owned.error) return owned.error;

    const savedAnswers = await prisma.candidateAnswer.findMany({
      where: {
        sessionId: owned.attempt.id,
        questionId: { in: questionIds.map(String) },
      },
      select: {
        questionId: true,
        answer: true,
      },
    });

    const answers = {};
    savedAnswers.forEach((answer) => {
      answers[answer.questionId] = answer.answer;
    });

    return NextResponse.json({
      success: true,
      answers: answers,
    });
  } catch (error) {
    console.error("Error getting answers:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get answers",
      },
      { status: 500 }
    );
  }
}
