import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { sendActivationEmail } from "../../../../../lib/emailService";
import crypto from "crypto";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

export const runtime = "nodejs";

function isAdmin(role) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

// GET /api/cohorts/[id]/examiners - List examiners assigned to this cohort
export async function GET(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: cohortId } = await params;
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true },
    });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }
    const assignments = await prisma.cohortExaminer.findMany({
      where: { cohortId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
            role: true,
            isSuspended: true,
            organisation: true,
            phone: true,
          },
        },
        assigner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });
    return NextResponse.json({
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        assignedAt: a.assignedAt,
        assignedBy: a.assignedBy,
        assigner: a.assigner,
        user: a.user,
      })),
    });
  } catch (e) {
    console.error("Error listing cohort examiners:", e);
    return NextResponse.json(
      { error: "Failed to list examiners", details: e.message },
      { status: 500 }
    );
  }
}

// POST /api/cohorts/[id]/examiners - Assign examiner (existing userId or create new user)
export async function POST(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: cohortId } = await params;
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true },
    });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }
    const body = await request.json();

    if (body.createNew) {
      const {
        firstName,
        middleName,
        lastName,
        email,
        organisation,
        contact,
      } = body;
      if (!email || !firstName || !lastName) {
        return NextResponse.json(
          { error: "First name, last name, and email are required" },
          { status: 400 }
        );
      }
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists. Use Search to assign them." },
          { status: 400 }
        );
      }
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || `${firstName} ${lastName}`.trim();
      const activationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const assignerId = request.headers.get("x-user-id") ?? null;
      const user = await prisma.user.create({
        data: {
          email,
          username: email.split("@")[0],
          passwordHash: crypto.randomBytes(32).toString("hex"),
          fullName,
          firstName: (firstName || "").trim(),
          middleName: middleName ? middleName.trim() : null,
          lastName: (lastName || "").trim(),
          organisation: organisation ? organisation.trim() : null,
          phone: contact ? String(contact).trim() : null,
          role: "EXAMINER",
          isActive: true,
          isActivated: false,
          isSuperadmin: false,
          cannotBeDeleted: false,
          createdBy: assignerId,
        },
      });
      await prisma.accountActivationToken.create({
        data: { userId: user.id, token: activationToken, expiresAt },
      });
      await sendActivationEmail(user.email, user.fullName, activationToken);
      await prisma.cohortExaminer.create({
        data: { cohortId, userId: user.id, assignedBy: assignerId },
      });
      const cohortName = (await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } }))?.name;
      const actor = await prisma.user.findUnique({ where: { id: request.headers.get("x-user-id") }, select: { fullName: true, email: true, organisation: true } });
      await createLog({
        actorType: "USER",
        userId: request.headers.get("x-user-id"),
        actorName: actor?.fullName ?? null,
        actorEmail: actor?.email ?? null,
        actorOrg: actor?.organisation ?? null,
        actorRole: request.headers.get("x-user-role"),
        actionType: ACTION_TYPES.ASSIGN_EXAMINER,
        resource: "cohort",
        description: `Assigned examiner "${user.fullName}" (${user.email}) to cohort "${cohortName ?? cohortId}"`,
        ...getRequestMeta(request),
      });
      return NextResponse.json({
        success: true,
        message: "Examiner created and assigned. Activation email sent.",
        data: { userId: user.id, created: true },
      });
    }

    const { userId } = body;
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required when not creating a new user" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isSuspended: true, isActivated: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role !== "EXAMINER") {
      return NextResponse.json(
        { error: "Only users with Examiner role can be assigned to a cohort" },
        { status: 400 }
      );
    }
    if (user.isSuspended) {
      return NextResponse.json(
        { error: "Suspended users cannot be assigned" },
        { status: 400 }
      );
    }
    const existing = await prisma.cohortExaminer.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This examiner is already assigned to the cohort" },
        { status: 400 }
      );
    }
    const assignerId = request.headers.get("x-user-id") ?? null;
    await prisma.cohortExaminer.create({
      data: { cohortId, userId, assignedBy: assignerId },
    });
    const cohortName = (await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } }))?.name;
    const assignedUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
    const actor = await prisma.user.findUnique({ where: { id: request.headers.get("x-user-id") }, select: { fullName: true, email: true, organisation: true } });
    await createLog({
      actorType: "USER",
      userId: request.headers.get("x-user-id"),
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: request.headers.get("x-user-role"),
      actionType: ACTION_TYPES.ASSIGN_EXAMINER,
      resource: "cohort",
      description: `Assigned examiner "${assignedUser?.fullName}" (${assignedUser?.email}) to cohort "${cohortName ?? cohortId}"`,
      ...getRequestMeta(request),
    });
    return NextResponse.json({
      success: true,
      message: "Examiner assigned to cohort",
      data: { userId },
    });
  } catch (e) {
    console.error("Error assigning examiner:", e);
    return NextResponse.json(
      { error: "Failed to assign examiner", details: e.message },
      { status: 500 }
    );
  }
}

