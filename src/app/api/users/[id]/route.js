import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

function canManageUsers(role) {
  return role && ADMIN_ROLES.includes(role);
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  organisation: true,
  phone: true,
  role: true,
  isActive: true,
  isActivated: true,
  isSuspended: true,
  suspensionReason: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  cannotBeDeleted: true,
  isSuperadmin: true,
  createdBy: true,
};

// GET /api/users/[id] - Get user by ID (Admin or Superadmin)
export async function GET(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    const actorId = request.headers.get("x-user-id");
    const actorEmail = request.headers.get("x-user-email");

    if (!canManageUsers(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const creator = user.createdBy
      ? await prisma.user.findUnique({
          where: { id: user.createdBy },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_USER,
      resource: "user",
      description: `Viewed user "${user.fullName}" (${user.email})`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: { ...user, creator },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user, suspend (reason required), or unsuspend (Admin or Superadmin)
export async function PUT(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    const actorId = request.headers.get("x-user-id");
    const actorEmail = request.headers.get("x-user-email");

    if (!canManageUsers(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      email,
      firstName,
      middleName,
      lastName,
      organisation,
      contact,
      role,
      isActive,
      isSuspended,
      suspensionReason,
    } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existingUser.isSuperadmin || existingUser.cannotBeDeleted) {
      return NextResponse.json(
        { error: "Cannot modify superadmin account" },
        { status: 400 }
      );
    }

    if (role) {
      const validRoles = ["ADMIN", "EXAMINER"];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: "Invalid role. Must be ADMIN or EXAMINER" },
          { status: 400 }
        );
      }
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: "Email already taken by another user" },
          { status: 400 }
        );
      }
    }

    const updateData = {};

    if (typeof isSuspended === "boolean") {
      updateData.isSuspended = isSuspended;
      if (isSuspended) {
        if (
          typeof suspensionReason !== "string" ||
          !suspensionReason.trim()
        ) {
          return NextResponse.json(
            { error: "Suspension reason is required when suspending a user" },
            { status: 400 }
          );
        }
        updateData.suspensionReason = suspensionReason.trim();
      } else {
        updateData.suspensionReason = null;
      }
    }

    if (email) {
      updateData.email = email;
      updateData.username = email.split("@")[0];
    }
    if (typeof firstName === "string") updateData.firstName = firstName.trim();
    if (typeof middleName === "string")
      updateData.middleName = middleName.trim() || null;
    if (typeof lastName === "string") updateData.lastName = lastName.trim();
    if (typeof organisation === "string")
      updateData.organisation = organisation.trim() || null;
    if (typeof contact === "string" || typeof contact === "number")
      updateData.phone = String(contact).trim() || null;
    if (role) updateData.role = role;
    if (typeof isActive === "boolean") updateData.isActive = isActive;

    if (
      updateData.firstName !== undefined ||
      updateData.middleName !== undefined ||
      updateData.lastName !== undefined
    ) {
      const fn =
        updateData.firstName ?? existingUser.firstName ?? "";
      const mn =
        updateData.middleName !== undefined
          ? updateData.middleName
          : existingUser.middleName;
      const ln =
        updateData.lastName ?? existingUser.lastName ?? "";
      updateData.fullName = [fn, mn, ln].filter(Boolean).join(" ").trim() || `${fn} ${ln}`.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    if (updateData.isSuspended === true) {
      await prisma.userSession.deleteMany({ where: { userId: id } });
    }

    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    const action = updateData.isSuspended === true
      ? ACTION_TYPES.SUSPEND_USER
      : updateData.isSuspended === false
        ? ACTION_TYPES.UNSUSPEND_USER
        : ACTION_TYPES.EDIT_USER;
    const desc = updateData.isSuspended === true
      ? `Suspended user "${existingUser.fullName}" (${existingUser.email}). Reason: ${updateData.suspensionReason || ""}`
      : updateData.isSuspended === false
        ? `Unsuspended user "${existingUser.fullName}" (${existingUser.email})`
        : `Edited user "${updatedUser.fullName}" (${updatedUser.email})`;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: action,
      resource: "user",
      description: desc,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      {
        error: "Failed to update user",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user (Admin or Superadmin)
export async function DELETE(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    const actorId = request.headers.get("x-user-id");
    const actorEmail = request.headers.get("x-user-email");

    if (!canManageUsers(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deletion of superadmin
    if (existingUser.isSuperadmin) {
      return NextResponse.json(
        { error: "Cannot delete superadmin account" },
        { status: 400 }
      );
    }

    // Check if user has created cohorts or interviews
    const userCohorts = await prisma.cohort.count({
      where: { createdBy: id },
    });

    const userInterviews = await prisma.interview.count({
      where: { createdBy: id },
    });

    if (userCohorts > 0 || userInterviews > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete user. User has created cohorts or interviews. Deactivate instead.",
          details: {
            cohorts: userCohorts,
            interviews: userInterviews,
          },
        },
        { status: 400 }
      );
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.DELETE_USER,
      resource: "user",
      description: `Deleted user "${existingUser.fullName}" (${existingUser.email})`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      {
        error: "Failed to delete user",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
