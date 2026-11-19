import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { canAccessQuestionBank } from "@/lib/questionBankAccess";

export const runtime = "nodejs";

// GET /api/question-banks - List question banks the current user can access
export async function GET(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const banks = await prisma.questionBank.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: "ALL_USERS" },
          { scope: "ADMIN_ONLY" },
          { scope: "PRIVATE", createdBy: userId },
        ],
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const filtered = banks.filter((b) => canAccessQuestionBank(userId, userRole, b));
    const list = filtered.map(({ _count, ...b }) => ({ ...b, questionCount: _count.questions }));

    return NextResponse.json({ success: true, questionBanks: list });
  } catch (error) {
    console.error("Error listing question banks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list question banks" },
      { status: 500 }
    );
  }
}

// POST /api/question-banks - Create a question bank
export async function POST(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, isActive = true, scope = "ALL_USERS" } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Question bank name is required" },
        { status: 400 }
      );
    }

    const validScopes = ["ALL_USERS", "ADMIN_ONLY", "PRIVATE"];
    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { success: false, error: "Invalid scope. Use ALL_USERS, ADMIN_ONLY, or PRIVATE" },
        { status: 400 }
      );
    }
    if (scope === "ADMIN_ONLY" && userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Only admins can create question banks with scope Admin only" },
        { status: 403 }
      );
    }

    const bank = await prisma.questionBank.create({
      data: {
        name: name.trim(),
        isActive: Boolean(isActive),
        scope,
        createdBy: userId,
      },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });

    return NextResponse.json({
      success: true,
      questionBank: { ...bank, questionCount: 0 },
      message: "Question bank created successfully",
    });
  } catch (error) {
    console.error("Error creating question bank:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create question bank" },
      { status: 500 }
    );
  }
}
