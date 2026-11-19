import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditQuestionBank } from "@/lib/questionBankAccess";
import { requireApiUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

// PUT /api/question-banks/[id]/questions/[questionId] - Update a question
export async function PUT(request, { params }) {
  try {
    const { id, questionId } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) return NextResponse.json({ success: false, error: "Question bank not found" }, { status: 404 });
    if (!canEditQuestionBank(userId, userRole, bank)) {
      return NextResponse.json({ success: false, error: "You do not have permission to edit" }, { status: 403 });
    }
    const existing = await prisma.questionBankQuestion.findFirst({
      where: { id: questionId, questionBankId: id },
    });
    if (!existing) return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    const body = await request.json();
    const { questionText, questionType, options, correctAnswer, points } = body;
    const data = {};
    if (questionText !== undefined) data.questionText = String(questionText).trim();
    if (questionType !== undefined) data.questionType = questionType;
    if (options !== undefined) data.options = Array.isArray(options) ? options : null;
    if (correctAnswer !== undefined) data.correctAnswer = correctAnswer;
    if (points !== undefined) data.points = parseInt(points, 10) || 1;
    const question = await prisma.questionBankQuestion.update({
      where: { id: questionId },
      data,
    });
    return NextResponse.json({ success: true, question, message: "Question updated successfully" });
  } catch (error) {
    console.error("Error updating question bank question:", error);
    return NextResponse.json({ success: false, error: "Failed to update question" }, { status: 500 });
  }
}

// DELETE /api/question-banks/[id]/questions/[questionId] - Delete a question
export async function DELETE(request, { params }) {
  try {
    const { id, questionId } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) return NextResponse.json({ success: false, error: "Question bank not found" }, { status: 404 });
    if (!canEditQuestionBank(userId, userRole, bank)) {
      return NextResponse.json({ success: false, error: "You do not have permission to delete" }, { status: 403 });
    }
    const existing = await prisma.questionBankQuestion.findFirst({
      where: { id: questionId, questionBankId: id },
    });
    if (!existing) return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    await prisma.questionBankQuestion.delete({ where: { id: questionId } });
    return NextResponse.json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question bank question:", error);
    return NextResponse.json({ success: false, error: "Failed to delete question" }, { status: 500 });
  }
}
