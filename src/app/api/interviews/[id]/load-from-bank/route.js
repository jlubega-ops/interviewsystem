import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessQuestionBank } from "@/lib/questionBankAccess";
import { requireApiUser } from "@/lib/apiAuth";
import { invalidateInterview } from "@/lib/cachedReads";

export const runtime = "nodejs";

// POST /api/interviews/[id]/load-from-bank - Load selected questions from a question bank into the interview
export async function POST(request, { params }) {
  try {
    const { id: interviewId } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview) {
      return NextResponse.json({ success: false, error: "Interview not found" }, { status: 404 });
    }
    if (interview.type !== "APTITUDE") {
      return NextResponse.json({ success: false, error: "Only aptitude interviews support loading from question bank" }, { status: 400 });
    }
    const body = await request.json();
    const { questionBankId, questionIds } = body;
    if (!questionBankId || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ success: false, error: "questionBankId and non-empty questionIds are required" }, { status: 400 });
    }
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!bank) return NextResponse.json({ success: false, error: "Question bank not found" }, { status: 404 });
    if (!canAccessQuestionBank(userId, userRole, bank)) {
      return NextResponse.json({ success: false, error: "You do not have access to this question bank" }, { status: 403 });
    }
    const bankQuestions = await prisma.questionBankQuestion.findMany({
      where: { questionBankId, id: { in: questionIds } },
      orderBy: { orderIndex: "asc" },
    });
    const existingInterviewQuestions = await prisma.question.findMany({
      where: { interviewId },
      select: { id: true, questionText: true },
    });
    const existingTexts = new Set(
      existingInterviewQuestions.map((q) => (q.questionText || "").trim().toLowerCase().slice(0, 200))
    );
    const alreadyInInterview = [];
    const toCreate = [];
    for (const bq of bankQuestions) {
      const key = (bq.questionText || "").trim().toLowerCase().slice(0, 200);
      if (existingTexts.has(key)) {
        alreadyInInterview.push(bq.questionText ? bq.questionText.slice(0, 80) + "..." : bq.id);
        continue;
      }
      toCreate.push(bq);
      existingTexts.add(key);
    }
    const lastOrder = await prisma.question.findFirst({
      where: { interviewId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    let orderIndex = (lastOrder?.orderIndex ?? 0) + 1;
    for (const bq of toCreate) {
      await prisma.question.create({
        data: {
          interviewId,
          questionText: bq.questionText,
          questionType: bq.questionType || "MULTIPLE_CHOICE",
          options: bq.options,
          correctAnswer: bq.correctAnswer,
          points: bq.points ?? 1,
          orderIndex: orderIndex++,
        },
      });
    }
    await prisma.interview.update({
      where: { id: interviewId },
      data: { totalQuestions: { increment: toCreate.length } },
    });
    if (toCreate.length > 0) {
      invalidateInterview(interviewId);
    }

    return NextResponse.json({
      success: true,
      loaded: toCreate.length,
      alreadyInInterview,
      message: toCreate.length
        ? `${toCreate.length} question(s) loaded.${alreadyInInterview.length ? ` ${alreadyInInterview.length} already in interview.` : ""}`
        : alreadyInInterview.length
          ? "No new questions loaded; all selected already exist in the interview."
          : "No questions loaded.",
    });
  } catch (error) {
    console.error("Error loading from question bank:", error);
    return NextResponse.json({ success: false, error: "Failed to load questions" }, { status: 500 });
  }
}
