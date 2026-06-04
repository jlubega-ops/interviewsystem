import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";

// PUT /api/interviews/[id]/questions/[questionId] - Update a question
export async function PUT(request, { params }) {
  try {
    const { id, questionId: questionIdParam } = await params;
    const interviewId = id;
    const questionId = questionIdParam;

    // Verify session from cookie
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify session in database
    const session = await prisma.userSession.findUnique({
      where: { sessionId: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if session is expired (1 hour timeout)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeDiff > oneHour) {
      // Session expired, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    const { questionText, questionType, options, correctAnswer, points } =
      await request.json();

    // Validate required fields
    if (!questionText || !questionType || !points) {
      return NextResponse.json(
        {
          success: false,
          error: "Question text, type, and points are required",
        },
        { status: 400 }
      );
    }

    // For non-typing questions, validate options and correctAnswer
    if (questionType !== "TYPING") {
      if (!options || !correctAnswer) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Options and correct answer are required for non-typing questions",
          },
          { status: 400 }
        );
      }
    }

    // Check if question exists in this interview
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        interviewId: interviewId,
      },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, error: "Question not found in this interview" },
        { status: 404 }
      );
    }

    // Update question
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        questionText: questionText,
        questionType: questionType,
        options: questionType === "TYPING" ? null : options,
        correctAnswer: questionType === "TYPING" ? null : correctAnswer,
        points: parseInt(points),
      },
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
      message: "Question updated successfully",
    });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update question",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/interviews/[id]/questions/[questionId] - Delete a question
export async function DELETE(request, { params }) {
  try {
    const { id, questionId: questionIdParam } = await params;
    const interviewId = id;
    const questionId = questionIdParam;

    // Verify session from cookie
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify session in database
    const session = await prisma.userSession.findUnique({
      where: { sessionId: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if session is expired (1 hour timeout)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeDiff > oneHour) {
      // Session expired, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    // Check if question exists in this interview
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        interviewId: interviewId,
      },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, error: "Question not found in this interview" },
        { status: 404 }
      );
    }

    // Check if any candidate has answered this question
    const answeredCount = await prisma.candidateAnswer.count({
      where: { questionId: questionId },
    });

    if (answeredCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete question: candidates have already answered it.",
        },
        { status: 400 }
      );
    }

    // Delete the question
    await prisma.question.delete({
      where: { id: questionId },
    });

    // Update interview total questions count
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        totalQuestions: {
          decrement: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete question",
      },
      { status: 500 }
    );
  }
}
