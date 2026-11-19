import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getInterviewWithQuestions, invalidateInterview } from "../../../../../lib/cachedReads";

export const runtime = "nodejs";

// GET /api/interviews/[id]/questions - Fetch questions for an interview
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const interviewId = id;

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

    const interview = await getInterviewWithQuestions(interviewId);
    const questions = interview?.questions || [];

    return NextResponse.json({
      success: true,
      questions: questions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch questions",
      },
      { status: 500 }
    );
  }
}

// POST /api/interviews/[id]/questions - Create a new question
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const interviewId = id;

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

    // Check if interview exists
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get the next order index
    const lastQuestion = await prisma.question.findFirst({
      where: { interviewId: interviewId },
      orderBy: { orderIndex: "desc" },
    });

    const nextOrderIndex = lastQuestion ? lastQuestion.orderIndex + 1 : 1;

    // Create question
    const question = await prisma.question.create({
      data: {
        interviewId: interviewId,
        questionText: questionText,
        questionType: questionType,
        options: questionType === "TYPING" ? null : options,
        correctAnswer: questionType === "TYPING" ? null : correctAnswer,
        points: parseInt(points),
        orderIndex: nextOrderIndex,
      },
    });

    // Update interview total questions count
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        totalQuestions: {
          increment: 1,
        },
      },
    });

    invalidateInterview(interviewId);

    return NextResponse.json({
      success: true,
      question: question,
      message: "Question created successfully",
    });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create question",
      },
      { status: 500 }
    );
  }
}
