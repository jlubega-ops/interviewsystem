import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { invalidateInterview } from "../../../../lib/cachedReads";
import { prisma } from "../../../../lib/prisma";
import { parseQuestions } from "../../../../lib/questionParser";

export const runtime = "nodejs";

// POST /api/interviews/upload-questions - Bulk upload questions from text
export async function POST(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const { interviewId, questionText } = await request.json();

    if (!interviewId) {
      return NextResponse.json(
        { success: false, error: "Interview ID is required" },
        { status: 400 }
      );
    }

    // Ensure interviewId is a string (UUID)
    const interviewIdStr = String(interviewId);

    if (!questionText || !questionText.trim()) {
      return NextResponse.json(
        { success: false, error: "Question text is required" },
        { status: 400 }
      );
    }

    // Verify interview exists
    const interview = await prisma.interview.findUnique({
      where: { id: interviewIdStr },
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Parse questions from text (options come as string[]; convert to { letter, text } for DB)
    const parsed = parseQuestions(questionText);
    const questions = parsed.map((q) => ({
      ...q,
      options: (q.options || []).map((text, i) => ({ letter: "ABCD"[i] || String.fromCharCode(65 + i), text: String(text).trim() })),
    }));

    if (questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid questions found in the text" },
        { status: 400 }
      );
    }

    // Process questions
    const results = {
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      successMessages: [],
      errorMessages: [],
    };

    // Get current question count for ordering
    const existingQuestions = await prisma.question.findMany({
      where: { interviewId: interviewIdStr },
      orderBy: { orderIndex: "desc" },
      take: 1,
    });

    let nextOrderIndex =
      existingQuestions.length > 0 ? existingQuestions[0].orderIndex + 1 : 1;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      try {
        // Validate question
        if (!question.questionText || question.questionText.trim() === "") {
          results.errorCount++;
          results.errorMessages.push(
            `Question ${i + 1}: Question text is required`
          );
          continue;
        }

        if (!question.correctAnswer || question.correctAnswer.trim() === "") {
          results.errorCount++;
          results.errorMessages.push(
            `Question ${i + 1}: Correct answer is required`
          );
          continue;
        }

        if (!question.options || question.options.length < 2) {
          results.errorCount++;
          results.errorMessages.push(
            `Question ${i + 1}: At least 2 options are required`
          );
          continue;
        }

        // Validate correct answer is one of the options
        const validAnswers = ["A", "B", "C", "D"];
        if (!validAnswers.includes(question.correctAnswer)) {
          results.errorCount++;
          results.errorMessages.push(
            `Question ${i + 1}: Correct answer must be A, B, C, or D`
          );
          continue;
        }

        // Check if question already exists (by text similarity)
        const existingQuestion = await prisma.question.findFirst({
          where: {
            interviewId: interviewIdStr,
            questionText: {
              contains: question.questionText.substring(0, 50), // Check first 50 chars
            },
          },
        });

        if (existingQuestion) {
          results.skippedCount++;
          results.successMessages.push(
            `Question ${i + 1}: Similar question already exists`
          );
          continue;
        }

        // Create question (preserve HTML formatting if present)
        const createdQuestion = await prisma.question.create({
          data: {
            interviewId: interviewIdStr,
            questionText: question.questionText.trim(),
            questionType: "MULTIPLE_CHOICE",
            options: question.options,
            correctAnswer: question.correctAnswer,
            points: question.points || 1, // Use provided points or default to 1
            orderIndex: nextOrderIndex++,
          },
        });

        results.successCount++;
        results.successMessages.push(
          `Question ${i + 1}: Created "${question.questionText.substring(
            0,
            50
          )}..."`
        );
      } catch (error) {
        console.error(`Error processing question ${i + 1}:`, error);
        results.errorCount++;
        results.errorMessages.push(
          `Question ${i + 1}: Error processing - ${error.message}`
        );
      }
    }

    // Update interview total questions count
    if (results.successCount > 0) {
      await prisma.interview.update({
        where: { id: interviewIdStr },
        data: {
          totalQuestions: {
            increment: results.successCount,
          },
        },
      });
    }

    if (results.successCount > 0) {
      invalidateInterview(interviewIdStr);
    }

    return NextResponse.json({
      success: true,
      message: "Bulk question upload completed",
      ...results,
    });
  } catch (error) {
    console.error("Bulk question upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process questions" },
      { status: 500 }
    );
  }
}

