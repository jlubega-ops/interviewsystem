import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendActivationEmail } from "../../../lib/emailService";
import crypto from "crypto";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../lib/activityLog.js";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

function canManageUsers(role) {
  return role && ADMIN_ROLES.includes(role);
}

// GET /api/users - Get all users (Admin or Superadmin)
export async function GET(request) {
  try {
    const userRole = request.headers.get("x-user-role");
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");

    if (!canManageUsers(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const creatorIds = [...new Set(users.map((u) => u.createdBy).filter(Boolean))];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));
    const usersWithCreator = users.map((u) => ({
      ...u,
      creator: u.createdBy ? creatorMap[u.createdBy] ?? null : null,
    }));

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_USERS,
      resource: "user",
      description: "Viewed users list",
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: usersWithCreator,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user (Admin or Superadmin). Sends activation email; link valid 2 days.
export async function POST(request) {
  try {
    const userRole = request.headers.get("x-user-role");
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");

    if (!canManageUsers(userRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      email,
      role,
      organisation,
      contact,
    } = body;

    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json(
        {
          error:
            "First name, last name, email, and role are required.",
        },
        { status: 400 }
      );
    }

    const validRoles = ["ADMIN", "EXAMINER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be ADMIN or EXAMINER" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const fullName = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || `${firstName} ${lastName}`.trim();

    const activationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

    const user = await prisma.user.create({
      data: {
        email,
        username: email.split("@")[0],
        passwordHash: crypto.randomBytes(32).toString("hex"), // Placeholder until activation
        fullName,
        firstName: firstName.trim(),
        middleName: middleName ? middleName.trim() : null,
        lastName: lastName.trim(),
        organisation: organisation ? organisation.trim() : null,
        phone: contact ? String(contact).trim() : null,
        role,
        isActive: true,
        cannotBeDeleted: false,
        isSuperadmin: false,
        isActivated: false,
        createdBy: userId ?? null,
      },
      select: {
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
        lastLoginAt: true,
        createdAt: true,
        cannotBeDeleted: true,
        isSuperadmin: true,
      },
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
    }

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.CREATE_USER,
      resource: "user",
      description: `Created user "${user.fullName}" (${user.email}) with role ${user.role}`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message:
        "User created successfully. Activation email sent (link valid for 2 days).",
      data: user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        error: "Failed to create user",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
