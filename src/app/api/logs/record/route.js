import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

// POST /api/logs/record - Record an admin action (e.g. VIEW_LOG_DETAIL). Admin only.
export async function POST(request) {
  try {
    const auth = await requireApiUser(request, { roles: ADMIN_ROLES });
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const userEmail = auth.user.email;

    const body = await request.json().catch(() => ({}));
    const { actionType, logId } = body;

    if (actionType !== ACTION_TYPES.VIEW_LOG_DETAIL) {
      return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
    }

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_LOG_DETAIL,
      resource: "log",
      description: logId ? `Viewed log entry ${logId}` : "Viewed log entry",
      ...getRequestMeta(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording log:", error);
    return NextResponse.json(
      { error: "Failed to record", details: error.message },
      { status: 500 }
    );
  }
}
