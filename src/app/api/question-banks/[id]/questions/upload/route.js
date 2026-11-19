import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEditQuestionBank } from "@/lib/questionBankAccess";
import { parseQuestions } from "@/lib/questionParser";
import { requireApiUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

function optionsToStoredFormat(optionsArray) {
  if (!Array.isArray(optionsArray)) return null;
  const letters = ["A", "B", "C", "D"];
  return optionsArray.slice(0, 6).map((text, i) => ({ letter: letters[i] || String.fromCharCode(65 + i), text: String(text).trim() }));
}

// POST /api/question-banks/[id]/questions/upload - Bulk upload (default points 1 per question)
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) return NextResponse.json({ success: false, error: "Question bank not found" }, { status: 404 });
    if (!canEditQuestionBank(userId, userRole, bank)) {
      return NextResponse.json({ success: false, error: "You do not have permission to add questions" }, { status: 403 });
    }
    const body = await request.json();
    const questionText = body.questionText || body.text || "";
    if (!questionText.trim()) {
      return NextResponse.json({ success: false, error: "Question text is required" }, { status: 400 });
    }
    const parsed = parseQuestions(questionText);
    if (parsed.length === 0) {
      return NextResponse.json({ success: false, error: "No valid questions found in the text" }, { status: 400 });
    }
    const errors = [];
    const valid = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      if (!q.questionText || !q.questionText.trim()) {
        errors.push(`Question ${i + 1}: Question text is required`);
        continue;
      }
      if (!q.correctAnswer || !["A", "B", "C", "D"].includes(q.correctAnswer)) {
        errors.push(`Question ${i + 1}: Valid correct answer (A-D) is required`);
        continue;
      }
      if (!q.options || q.options.length < 2) {
        errors.push(`Question ${i + 1}: At least 2 options are required`);
        continue;
      }
      valid.push({ ...q, points: q.points || 1 });
    }
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        errors,
        validCount: valid.length,
      }, { status: 400 });
    }
    const last = await prisma.questionBankQuestion.findFirst({
      where: { questionBankId: id },
      orderBy: { orderIndex: "desc" },
    });
    let orderIndex = (last?.orderIndex ?? 0) + 1;
    const created = [];
    for (const q of valid) {
      const question = await prisma.questionBankQuestion.create({
        data: {
          questionBankId: id,
          questionText: q.questionText.trim(),
          questionType: "MULTIPLE_CHOICE",
          options: optionsToStoredFormat(q.options),
          correctAnswer: q.correctAnswer,
          points: q.points ?? 1,
          orderIndex: orderIndex++,
        },
      });
      created.push(question);
    }
    return NextResponse.json({
      success: true,
      message: `${created.length} question(s) uploaded successfully`,
      count: created.length,
      questions: created,
    });
  } catch (error) {
    console.error("Question bank upload error:", error);
    return NextResponse.json({ success: false, error: "Failed to upload questions" }, { status: 500 });
  }
}
