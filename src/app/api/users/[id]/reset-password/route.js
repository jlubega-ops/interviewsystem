import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { sendPasswordResetEmail } from "../../../../../lib/emailService";
import crypto from "crypto";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

export const runtime = "nodejs";

// POST /api/users/[id]/reset-password - Admin reset user password
export async function POST(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];
    if (!userRole || !ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(
      user.email,
      user.fullName,
      resetToken
    );

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send password reset email" },
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
      actionType: ACTION_TYPES.RESET_PASSWORD_EMAIL,
      resource: "user",
      description: `Sent password reset email to user "${user.fullName}" (${user.email})`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "Password reset link has been sent to the user's email",
    });
  } catch (error) {
    console.error("Error sending password reset:", error);
    return NextResponse.json(
      {
        error: "Failed to send password reset",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
