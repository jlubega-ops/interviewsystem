import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiAuth";
import { invalidateCohort, invalidateEnrollment } from "../../../../../../lib/cachedReads";
import { prisma } from "../../../../../../lib/prisma";
import { ACCESS_KEY_SAFE_CHARS } from "../../../../../../lib/tokenUtils";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// PUT /api/cohorts/[id]/enrollments/[enrollmentId] - Update enrollment (suspend/activate)
export async function PUT(request, { params }) {
  try {
    const { id, enrollmentId: enrollmentIdParam } = await params;
    const cohortId = id;
    const enrollmentId = enrollmentIdParam;
    const body = await request.json();
    const { action } = body;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const actorId = auth.user.id;
    const actorRole = auth.user.role;
    const actorEmail = auth.user.email;

    if (!cohortId || !enrollmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cohort or enrollment ID",
        },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ["suspend", "activate", "reset_access"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid action. Valid actions: suspend, activate, reset_access",
        },
        { status: 400 }
      );
    }

    // Check if enrollment exists
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        id: enrollmentId,
        cohortId: cohortId,
      },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "Enrollment not found",
        },
        { status: 404 }
      );
    }

    let updateData = {};

    if (action === "suspend") {
      updateData = { status: "UNENROLLED" };
    } else if (action === "activate") {
      updateData = { status: "ENROLLED" };
    } else if (action === "reset_access") {
      // Generate new access key
      const newAccessKey = await generateUniqueAccessKey();
      updateData = { accessKey: newAccessKey };
    }

    const updatedEnrollment = await prisma.cohortEnrollment.update({
      where: { id: enrollmentId },
      data: updateData,
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    let message = "";
    switch (action) {
      case "suspend":
        message = "Candidate suspended from cohort";
        break;
      case "activate":
        message = "Candidate activated in cohort";
        break;
      case "reset_access":
        message = "Access key reset successfully";
        break;
    }

    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } });
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    const desc = action === "suspend"
      ? `Suspended candidate "${enrollment.candidate?.fullName}" (${enrollment.candidate?.email}) from cohort "${cohort?.name ?? cohortId}"`
      : action === "activate"
        ? `Activated candidate "${enrollment.candidate?.fullName}" in cohort "${cohort?.name ?? cohortId}"`
        : `Reset access key for candidate "${enrollment.candidate?.fullName}" in cohort "${cohort?.name ?? cohortId}"`;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: actorRole ?? null,
      actionType: ACTION_TYPES.EDIT_COHORT,
      resource: "cohort",
      description: desc,
      ...getRequestMeta(request),
    });

    invalidateCohort(cohortId);
    if (updatedEnrollment?.accessKey) invalidateEnrollment(updatedEnrollment.accessKey);

    return NextResponse.json({
      success: true,
      enrollment: updatedEnrollment,
      message: message,
    });
  } catch (error) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update enrollment",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cohorts/[id]/enrollments/[enrollmentId] - Unenroll candidate
export async function DELETE(request, { params }) {
  try {
    const { id, enrollmentId: enrollmentIdParam } = await params;
    const cohortId = id;
    const enrollmentId = enrollmentIdParam;
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const actorId = auth.user.id;
    const actorRole = auth.user.role;
    const actorEmail = auth.user.email;

    if (!cohortId || !enrollmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cohort or enrollment ID",
        },
        { status: 400 }
      );
    }

    // Check if enrollment exists
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        id: enrollmentId,
        cohortId: cohortId,
      },
      include: {
        candidate: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "Enrollment not found",
        },
        { status: 404 }
      );
    }

    // Cascade: delete all attempts by this candidate in this cohort (sessions with this accessKey and cohort's interviews)
    const cohortInterviews = await prisma.cohortInterview.findMany({
      where: { cohortId },
      select: { interviewId: true },
    });
    const interviewIds = cohortInterviews.map((ci) => ci.interviewId);
    if (interviewIds.length > 0) {
      await prisma.candidateSession.deleteMany({
        where: {
          accessKey: enrollment.accessKey,
          interviewId: { in: interviewIds },
        },
      });
    }

    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } });
    const candidateName = enrollment.candidate?.fullName;
    const candidateEmail = enrollment.candidate?.email;
    await prisma.cohortEnrollment.delete({
      where: { id: enrollmentId },
    });

    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: actorRole ?? null,
      actionType: ACTION_TYPES.UNASSIGN_CANDIDATE,
      resource: "cohort",
      description: `Unassigned candidate "${candidateName}" (${candidateEmail}) from cohort "${cohort?.name ?? cohortId}"`,
      ...getRequestMeta(request),
    });

    invalidateCohort(cohortId);

    return NextResponse.json({
      success: true,
      message: "Candidate unenrolled successfully",
    });
  } catch (error) {
    console.error("Error unenrolling candidate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to unenroll candidate",
      },
      { status: 500 }
    );
  }
}

// Generate unique access key with format MUBEIIC/2025/XXXXXX (unambiguous chars only)
async function generateUniqueAccessKey() {
  const currentYear = new Date().getFullYear();
  const prefix = "MUBEIIC";
  const year = currentYear.toString();

  let accessKey;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += ACCESS_KEY_SAFE_CHARS.charAt(
        Math.floor(Math.random() * ACCESS_KEY_SAFE_CHARS.length)
      );
    }
    accessKey = `${prefix}/${year}/${suffix}`;

    // Check if access key already exists
    const existingKey = await prisma.cohortEnrollment.findFirst({
      where: { accessKey: accessKey },
    });

    if (!existingKey) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new Error("Unable to generate unique access key");
  }

  return accessKey;
}
