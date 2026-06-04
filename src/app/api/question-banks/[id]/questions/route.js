import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessQuestionBank, canEditQuestionBank } from "@/lib/questionBankAccess";

export const runtime = "nodejs";

function optionsToStoredFormat(optionsArray) {
  if (!Array.isArray(optionsArray)) return null;
  const letters = ["A", "B", "C", "D"];
  return optionsArray.slice(0, 6).map((opt, i) => {
    if (opt && typeof opt === "object" && "letter" in opt && "text" in opt) {
      return { letter: String(opt.letter || letters[i]).trim(), text: String(opt.text || "").trim() };
    }
    return { letter: letters[i] || String.fromCharCode(65 + i), text: String(opt).trim() };
  });
}

async function getBankAndCheckAccess(prisma, id, userId, userRole, needEdit = false) {
  const bank = await prisma.questionBank.findUnique({ where: { id } });
  if (!bank) return { error: "Question bank not found", status: 404 };
  const can = needEdit ? canEditQuestionBank(userId, userRole, bank) : canAccessQuestionBank(userId, userRole, bank);
  if (!can) return { error: "You do not have access to this question bank", status: 403 };
  return { bank };
}

// GET /api/question-banks/[id]/questions - List questions in the bank
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }
    const result = await getBankAndCheckAccess(prisma, id, userId, userRole);
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    const questions = await prisma.questionBankQuestion.findMany({
      where: { questionBankId: id },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("Error listing question bank questions:", error);
    return NextResponse.json({ success: false, error: "Failed to list questions" }, { status: 500 });
  }
}

// POST /api/question-banks/[id]/questions - Add a single question
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }
    const result = await getBankAndCheckAccess(prisma, id, userId, userRole, true);
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    const body = await request.json();
    const { questionText, questionType = "MULTIPLE_CHOICE", options, correctAnswer, points = 1 } = body;
    if (!questionText || !questionText.trim()) {
      return NextResponse.json({ success: false, error: "Question text is required" }, { status: 400 });
    }
    if (questionType !== "TYPING" && (!options || !correctAnswer)) {
      return NextResponse.json({ success: false, error: "Options and correct answer are required" }, { status: 400 });
    }
    const last = await prisma.questionBankQuestion.findFirst({
      where: { questionBankId: id },
      orderBy: { orderIndex: "desc" },
    });
    const orderIndex = (last?.orderIndex ?? 0) + 1;
    const storedOptions = questionType === "TYPING" ? null : optionsToStoredFormat(Array.isArray(options) ? options : []);
    const question = await prisma.questionBankQuestion.create({
      data: {
        questionBankId: id,
        questionText: questionText.trim(),
        questionType,
        options: storedOptions,
        correctAnswer: questionType === "TYPING" ? null : correctAnswer,
        points: parseInt(points, 10) || 1,
        orderIndex,
      },
    });
    return NextResponse.json({ success: true, question, message: "Question added successfully" });
  } catch (error) {
    console.error("Error adding question to bank:", error);
    return NextResponse.json({ success: false, error: "Failed to add question" }, { status: 500 });
  }
}
