import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

const profileSelect = {
  id: true,
  email: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  organisation: true,
  phone: true,
  role: true,
  profileCompletedAt: true,
  isActive: true,
  isActivated: true,
  lastLoginAt: true,
  createdAt: true,
};

// GET /api/auth/profile - Get current user profile (for profile page)
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await createLog({
      actorType: "USER",
      userId: user.id,
      actorName: user.fullName,
      actorEmail: user.email,
      actorOrg: user.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_PROFILE,
      resource: "profile",
      description: `Viewed own profile`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/profile - Update current user profile (only organisation and phone)
export async function PATCH(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organisation, contact } = body;

    const updateData = {};
    if (typeof organisation === "string") updateData.organisation = organisation.trim() || null;
    if (typeof contact === "string" || typeof contact === "number") updateData.phone = String(contact).trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No allowed fields to update (organisation, contact)" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { organisation: true, phone: true },
    });
    const newOrg = updateData.organisation !== undefined ? updateData.organisation : existing?.organisation;
    const newPhone = updateData.phone !== undefined ? updateData.phone : existing?.phone;
    if (newOrg?.trim() && newPhone?.trim()) {
      updateData.profileCompletedAt = new Date();
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: profileSelect,
    });

    await createLog({
      actorType: "USER",
      userId: user.id,
      actorName: user.fullName,
      actorEmail: user.email,
      actorOrg: user.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.UPDATE_PROFILE,
      resource: "profile",
      description: `Updated profile (organisation, contact)`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile", details: error.message },
      { status: 500 }
    );
  }
}
