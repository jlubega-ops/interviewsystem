import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../../lib/activityLog.js";

export const runtime = "nodejs";

const CONFIRM_WORD = "DELETE";

/**
 * POST /api/interviews/[id]/attempts/bulk-delete
 * Delete multiple candidate attempts. Admin/Examiner only. Body: { attemptIds: string[], confirmWord: "DELETE" }.
 */
export async function POST(request, { params }) {
  try {
    const { id: interviewId } = await params;

    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const attemptIds = Array.isArray(body?.attemptIds) ? body.attemptIds.filter((id) => typeof id === "string") : [];
    const confirmWord = typeof body?.confirmWord === "string" ? body.confirmWord.trim() : "";

    if (attemptIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No attempt IDs provided." },
        { status: 400 }
      );
    }

    if (confirmWord !== CONFIRM_WORD) {
      return NextResponse.json(
        { success: false, error: `You must type ${CONFIRM_WORD} in capital letters to confirm deletion.` },
        { status: 400 }
      );
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { type: true },
    });
    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found." },
        { status: 404 }
      );
    }

    const toDelete = await prisma.candidateSession.findMany({
      where: {
        id: { in: attemptIds },
        interviewId,
      },
      select: { id: true, candidateName: true, candidateEmail: true },
    });

    if (toDelete.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching attempts found to delete." },
        { status: 404 }
      );
    }

    await prisma.candidateSession.deleteMany({
      where: {
        id: { in: toDelete.map((a) => a.id) },
        interviewId,
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } });
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.DELETE_ATTEMPT,
      resource: "interview",
      description: `Bulk deleted ${toDelete.length} attempt(s) for ${interview.type ?? "interview"} interview`,
      targetInterviewId: interviewId,
      targetInterviewType: interview.type,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: `${toDelete.length} attempt(s) deleted successfully.`,
      deletedCount: toDelete.length,
    });
  } catch (error) {
    console.error("Error bulk deleting attempts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete attempts." },
      { status: 500 }
    );
  }
}
