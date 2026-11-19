import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiAuth";
import { prisma } from "../../../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../../lib/activityLog.js";

export const runtime = "nodejs";

function isAdmin(role) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

// DELETE /api/cohorts/[id]/examiners/[userId] - Unassign examiner from cohort
export async function DELETE(request, { params }) {
  try {
    const auth = await requireApiUser(request, { roles: ["SUPERADMIN", "ADMIN"] });
    if (auth.response) return auth.response;
    const actorId = auth.user.id;
    const { id: cohortId, userId } = await params;
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } });
    const unassignedUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
    await prisma.cohortExaminer.deleteMany({
      where: { cohortId, userId },
    });
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.UNASSIGN_EXAMINER,
      resource: "cohort",
      description: `Unassigned examiner "${unassignedUser?.fullName}" (${unassignedUser?.email}) from cohort "${cohort?.name ?? cohortId}"`,
      ...getRequestMeta(request),
    });
    return NextResponse.json({
      success: true,
      message: "Examiner unassigned from cohort",
    });
  } catch (e) {
    console.error("Error unassigning examiner:", e);
    return NextResponse.json(
      { error: "Failed to unassign examiner", details: e.message },
      { status: 500 }
    );
  }
}
