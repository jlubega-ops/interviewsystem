import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessQuestionBank } from "@/lib/questionBankAccess";
import { requireApiUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

// GET /api/question-banks/[id]/questions/download - Download questions in template format
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) return NextResponse.json({ success: false, error: "Question bank not found" }, { status: 404 });
    if (!canAccessQuestionBank(userId, userRole, bank)) {
      return NextResponse.json({ success: false, error: "You do not have access to this question bank" }, { status: 403 });
    }
    const questions = await prisma.questionBankQuestion.findMany({
      where: { questionBankId: id },
      orderBy: { orderIndex: "asc" },
    });
    const lines = [];
    questions.forEach((q) => {
      lines.push((q.questionText || "").replace(/\r?\n/g, " ").trim());
      const opts = Array.isArray(q.options) ? q.options : [];
      opts.forEach((o) => {
        const letter = o?.letter || "";
        const text = (o?.text || "").replace(/\r?\n/g, " ").trim();
        lines.push(`${letter}: ${text}`);
      });
      lines.push(`ANSWER: ${q.correctAnswer || ""}`);
      if (q.points != null && q.points !== 1) lines.push(`POINTS: ${q.points}`);
      lines.push("");
    });
    const text = lines.join("\n").trim();
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${(bank.name || "questions").replace(/[^a-zA-Z0-9_-]/g, "_")}_questions.txt"`,
      },
    });
  } catch (error) {
    console.error("Error downloading question bank questions:", error);
    return NextResponse.json({ success: false, error: "Failed to download" }, { status: 500 });
  }
}
