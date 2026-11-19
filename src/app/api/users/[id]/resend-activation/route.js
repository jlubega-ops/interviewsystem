import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../lib/apiAuth";
import { prisma } from "../../../../../lib/prisma";
import { sendActivationEmail } from "../../../../../lib/emailService";
import crypto from "crypto";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

function canManageUsers(role) {
  return role && ADMIN_ROLES.includes(role);
}

// POST /api/users/[id]/resend-activation - Resend activation email (Admin or Superadmin). Only for users who have not activated.
export async function POST(request, { params }) {
  try {
    const auth = await requireApiUser(request, { roles: ADMIN_ROLES });
    if (auth.response) return auth.response;
    const userRole = auth.user.role;
    const actorId = auth.user.id;
    const actorEmail = auth.user.email;

    const { id } = params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActivated: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isActivated) {
      return NextResponse.json(
        { error: "User has already activated their account." },
        { status: 400 }
      );
    }

    const activationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

    await prisma.accountActivationToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.accountActivationToken.create({
      data: {
        userId: user.id,
        token: activationToken,
        expiresAt,
      },
    });

    const emailResult = await sendActivationEmail(
      user.email,
      user.fullName,
      activationToken
    );

    if (!emailResult.success) {
      console.error("Failed to send activation email:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send activation email" },
        { status: 500 }
      );
    }

    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.RESEND_ACTIVATION,
      resource: "user",
      description: `Resent activation email to user "${user.fullName}" (${user.email})`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message:
        "Activation email resent. The link is valid for 2 days.",
    });
  } catch (error) {
    console.error("Error resending activation:", error);
    return NextResponse.json(
      {
        error: "Failed to resend activation email",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
