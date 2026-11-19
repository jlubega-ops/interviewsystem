import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../../lib/apiAuth";
import { prisma } from "../../../../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../../../lib/activityLog.js";

export const runtime = "nodejs";

/**
 * POST /api/interviews/[id]/attempts/[attemptId]/delete
 * Delete a candidate attempt. Requires admin auth and matching access key in body.
 */
export async function POST(request, { params }) {
  try {
    const { id: interviewId, attemptId } = await params;

    const auth = await requireApiUser(request, {
      roles: ["ADMIN", "EXAMINER", "SUPERADMIN"],
    });
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const body = await request.json();
    const accessKey = typeof body?.accessKey === "string" ? body.accessKey.trim().toUpperCase() : "";

    if (!accessKey) {
      return NextResponse.json(
        { success: false, error: "Access key is required to delete this attempt." },
        { status: 400 }
      );
    }

    const attempt = await prisma.candidateSession.findFirst({
      where: {
        id: attemptId,
        interviewId: interviewId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Attempt not found." },
        { status: 404 }
      );
    }

    const attemptAccessKey = (attempt.accessKey || "").trim().toUpperCase();
    if (accessKey !== attemptAccessKey) {
      return NextResponse.json(
        { success: false, error: "Access key does not match. Deletion cancelled." },
        { status: 403 }
      );
    }

    const candidateName = attempt.candidateName;
    const candidateEmail = attempt.candidateEmail;
    const interview = await prisma.interview.findUnique({ where: { id: interviewId }, select: { type: true } });
    await prisma.candidateSession.delete({
      where: { id: attemptId },
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
      description: `Deleted attempt for candidate "${candidateName}" (${candidateEmail}) - ${interview?.type ?? "interview"} interview`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "Attempt deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting attempt:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete attempt." },
      { status: 500 }
    );
  }
}
