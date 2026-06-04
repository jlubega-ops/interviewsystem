import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// POST /api/candidate/save-answer - Save individual answer
export async function POST(request) {
  try {
    // Check if request has body
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

    const { attemptId, questionId, answer, typingStats } = body;

    if (!attemptId || !questionId || answer === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Check if answer already exists
    const existingAnswer = await prisma.candidateAnswer.findFirst({
      where: {
        sessionId: attemptId,
        questionId: questionId,
      },
    });

    // Prepare answer data
    const answerData = {
      answer: answer,
      isCorrect: false, // Will be calculated on submission
    };

    // Add typing stats if provided (for typing interviews)
    if (typingStats) {
      answerData.typingStats = typingStats;
    }

    if (existingAnswer) {
      // Update existing answer
      await prisma.candidateAnswer.update({
        where: { id: existingAnswer.id },
        data: answerData,
      });
    } else {
      // Create new answer
      await prisma.candidateAnswer.create({
        data: {
          sessionId: attemptId,
          questionId: questionId,
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
