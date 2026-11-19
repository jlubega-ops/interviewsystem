import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";
import { assertOrganisationName } from "../../../../lib/organisations";

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
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

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
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const body = await request.json();
    const { organisation, contact } = body;

    const updateData = {};
    if (typeof organisation === "string") {
      const orgCheck = await assertOrganisationName(organisation, {
        required: true,
      });
      if (orgCheck.error) {
        return NextResponse.json({ error: orgCheck.error }, { status: 400 });
      }
      updateData.organisation = orgCheck.name;
    }
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
