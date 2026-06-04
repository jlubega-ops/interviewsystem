import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// POST /api/candidate/get-answers - Get saved answers for specific questions
export async function POST(request) {
  try {
    const { attemptId, questionIds } = await request.json();

    if (!attemptId || !questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get saved answers for the specified questions
    const savedAnswers = await prisma.candidateAnswer.findMany({
      where: {
        sessionId: attemptId,
        questionId: { in: questionIds },
      },
      select: {
        questionId: true,
        answer: true,
      },
    });

    // Convert to object for easy lookup
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
