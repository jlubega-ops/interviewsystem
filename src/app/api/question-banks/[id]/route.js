import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessQuestionBank, canEditQuestionBank } from "@/lib/questionBankAccess";
import { requireApiUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

// GET /api/question-banks/[id] - Get one question bank (with question count)
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        _count: { select: { questions: true } },
      },
    });

    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Question bank not found" },
        { status: 404 }
      );
    }

    if (!canAccessQuestionBank(userId, userRole, bank)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this question bank" },
        { status: 403 }
      );
    }

    const { _count, ...rest } = bank;
    return NextResponse.json({
      success: true,
      questionBank: { ...rest, questionCount: _count.questions },
    });
  } catch (error) {
    console.error("Error fetching question bank:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch question bank" },
      { status: 500 }
    );
  }
}

// PATCH /api/question-banks/[id] - Update question bank
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Question bank not found" },
        { status: 404 }
      );
    }
    if (!canEditQuestionBank(userId, userRole, bank)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to edit this question bank" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, isActive, scope } = body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (scope !== undefined) {
      const validScopes = ["ALL_USERS", "ADMIN_ONLY", "PRIVATE"];
      if (!validScopes.includes(scope)) {
        return NextResponse.json(
          { success: false, error: "Invalid scope" },
          { status: 400 }
        );
      }
      if (scope === "ADMIN_ONLY" && userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
        return NextResponse.json(
          { success: false, error: "Only admins can set scope to Admin only" },
          { status: 403 }
        );
      }
      data.scope = scope;
    }

    const updated = await prisma.questionBank.update({
      where: { id },
      data,
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        _count: { select: { questions: true } },
      },
    });
    const { _count, ...rest } = updated;
    return NextResponse.json({
      success: true,
      questionBank: { ...rest, questionCount: _count.questions },
      message: "Question bank updated successfully",
    });
  } catch (error) {
    console.error("Error updating question bank:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update question bank" },
      { status: 500 }
    );
  }
}

// DELETE /api/question-banks/[id] - Delete question bank
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Question bank not found" },
        { status: 404 }
      );
    }
    if (!canEditQuestionBank(userId, userRole, bank)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to delete this question bank" },
        { status: 403 }
      );
    }

    await prisma.questionBank.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      message: "Question bank deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting question bank:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete question bank" },
      { status: 500 }
    );
  }
}
