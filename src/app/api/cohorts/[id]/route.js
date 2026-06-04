import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// GET /api/cohorts/[id] - Fetch a specific cohort (examiner: only if assigned)
export async function GET(request, { params }) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const cohortId = id;

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Invalid cohort ID" },
        { status: 400 }
      );
    }

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        enrollments: {
          select: {
            id: true,
            status: true,
            enrolledAt: true,
          },
        },
        examiners: {
          select: {
            id: true,
            userId: true,
            assignedAt: true,
            assignedBy: true,
            assigner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                firstName: true,
                lastName: true,
                role: true,
                isSuspended: true,
              },
            },
          },
        },
        interviews: {
          select: {
            id: true,
            interviewType: true,
            createdAt: true,
            interview: {
              select: {
                id: true,
                type: true,
                description: true,
                durationMinutes: true,
                totalQuestions: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!cohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    if (userRole === "EXAMINER") {
      const assigned = await prisma.cohortExaminer.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
      });
      if (!assigned) {
        return NextResponse.json(
          { success: false, error: "Cohort not found" },
          { status: 404 }
        );
      }
    }

    // Ensure isPublished and resultsPublished are always read from DB
    let isPublished = cohort.isPublished;
    let resultsPublished = cohort.resultsPublished;
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT is_published, results_published FROM cohorts WHERE id = ? LIMIT 1",
        cohortId
      );
      const row = rows?.[0];
      if (row) {
        let val = row.is_published ?? row.Is_Published;
        if (typeof val === "number") isPublished = val !== 0;
        else if (typeof val === "boolean") isPublished = val;
        val = row.results_published ?? row.Results_Published;
        if (typeof val === "number") resultsPublished = val !== 0;
        else if (typeof val === "boolean") resultsPublished = val;
      }
    } catch (_) {}
    const transformedCohort = {
      ...cohort,
      isPublished,
      resultsPublished,
      enrollmentCount: cohort.enrollments?.length ?? 0,
      interviewCount: cohort.interviews?.length ?? 0,
      examinerCount: cohort.examiners?.length ?? 0,
    };

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } });
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_COHORT,
      resource: "cohort",
      description: `Viewed cohort "${cohort.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      cohort: transformedCohort,
    });
  } catch (error) {
    console.error("Error fetching cohort:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cohort",
      },
      { status: 500 }
    );
  }
}

// PUT /api/cohorts/[id] - Update a cohort (examiner: only if assigned)
export async function PUT(request, { params }) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const cohortId = id;
    const body = await request.json();
    const { name, description, instructions, openTime, closeTime, organisation, isPublished, resultsPublished } = body;

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Invalid cohort ID" },
        { status: 400 }
      );
    }

    if (userRole === "EXAMINER") {
      const assigned = await prisma.cohortExaminer.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
      });
      if (!assigned) {
        return NextResponse.json(
          { success: false, error: "Cohort not found" },
          { status: 404 }
        );
      }
    }

    // Validate required fields
    if (!name || !openTime || !closeTime) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, open time, and close time are required",
        },
        { status: 400 }
      );
    }

    // Validate dates
    const openDate = new Date(openTime);
    const closeDate = new Date(closeTime);

    if (openDate >= closeDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Close time must be after open time",
        },
        { status: 400 }
      );
    }

    // Check if cohort exists
    const existingCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!existingCohort) {
      return NextResponse.json(
        {
          success: false,
          error: "Cohort not found",
        },
        { status: 404 }
      );
    }

    const updateData = {
      name,
      description: description || null,
      instructions: instructions || null,
      openTime: openDate,
      closeTime: closeDate,
    };
    if (organisation !== undefined) updateData.organisation = organisation ? String(organisation).trim() : null;
    const updatedCohort = await prisma.cohort.update({
      where: { id: cohortId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        enrollments: { select: { id: true } },
        interviews: { select: { id: true } },
      },
    });

    // isPublished / resultsPublished: apply via raw update to avoid Prisma client schema drift
    if (typeof isPublished === "boolean") {
      await prisma.$executeRawUnsafe(
        "UPDATE cohorts SET is_published = ? WHERE id = ?",
        isPublished ? 1 : 0,
        cohortId
      );
    }
    if (typeof resultsPublished === "boolean") {
      await prisma.$executeRawUnsafe(
        "UPDATE cohorts SET results_published = ? WHERE id = ?",
        resultsPublished ? 1 : 0,
        cohortId
      );
    }

    const cohortResponse = {
      ...updatedCohort,
      enrollmentCount: updatedCohort.enrollments?.length ?? 0,
      interviewCount: updatedCohort.interviews?.length ?? 0,
    };
    if (typeof isPublished === "boolean") cohortResponse.isPublished = isPublished;
    if (typeof resultsPublished === "boolean") cohortResponse.resultsPublished = resultsPublished;

    return NextResponse.json({
      success: true,
      cohort: cohortResponse,
      message: "Cohort updated successfully",
    });
  } catch (error) {
    console.error("Error updating cohort:", error);
    const message = error?.message || "Failed to update cohort";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/cohorts/[id] - Update only publish status (for quick toggle on view page)
export async function PATCH(request, { params }) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const cohortId = id;
    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Invalid cohort ID" },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const isPublished = body.isPublished;
    const resultsPublished = body.resultsPublished;
    if (typeof isPublished !== "boolean" && typeof resultsPublished !== "boolean") {
      return NextResponse.json(
        { success: false, error: "isPublished or resultsPublished (boolean) is required" },
        { status: 400 }
      );
    }

    const existingCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });
    if (!existingCohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    if (userRole === "EXAMINER") {
      const assigned = await prisma.cohortExaminer.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
      });
      if (!assigned) {
        return NextResponse.json(
          { success: false, error: "Cohort not found" },
          { status: 404 }
        );
      }
    }

    // Use raw updates so toggles work even if Prisma client is stale
    if (typeof isPublished === "boolean") {
      await prisma.$executeRawUnsafe(
        "UPDATE cohorts SET is_published = ? WHERE id = ?",
        isPublished ? 1 : 0,
        cohortId
      );
    }
    if (typeof resultsPublished === "boolean") {
      await prisma.$executeRawUnsafe(
        "UPDATE cohorts SET results_published = ? WHERE id = ?",
        resultsPublished ? 1 : 0,
        cohortId
      );
    }

    const message = [];
    if (typeof isPublished === "boolean") message.push(isPublished ? "Cohort published." : "Cohort unpublished.");
    if (typeof resultsPublished === "boolean") message.push(resultsPublished ? "Results published." : "Results unpublished.");
    return NextResponse.json({
      success: true,
      isPublished: typeof isPublished === "boolean" ? isPublished : undefined,
      resultsPublished: typeof resultsPublished === "boolean" ? resultsPublished : undefined,
      message: message.join(" ") || "Updated.",
    });
  } catch (error) {
    console.error("Error updating cohort:", error);
    const message = error?.message || "Failed to update publish status";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/cohorts/[id] - Delete cohort (admin: any; examiner: only if they created the cohort)
export async function DELETE(request, { params }) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const cohortId = id;

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Invalid cohort ID" },
        { status: 400 }
      );
    }

    const existingCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!existingCohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Cohort can only be deleted by admin or by the examiner who created it.
    // If the cohort has candidates assigned or interviews with attempts, same rule: only admin or creator.
    if (userRole === "EXAMINER") {
      if (existingCohort.createdBy !== userId) {
        return NextResponse.json(
          { success: false, error: "Only the examiner who created this cohort (or an admin) can delete it." },
          { status: 403 }
        );
      }
    }

    const cohortName = existingCohort.name;

    // Cascade: delete all candidate attempts (sessions) for this cohort before deleting cohort.
    // Attempts are tied to accessKey (from enrollments) + interviewId (from cohort interviews).
    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId },
      select: { accessKey: true },
    });
    const cohortInterviews = await prisma.cohortInterview.findMany({
      where: { cohortId },
      select: { interviewId: true },
    });
    const accessKeys = enrollments.map((e) => e.accessKey);
    const interviewIds = cohortInterviews.map((ci) => ci.interviewId);
    if (accessKeys.length > 0 && interviewIds.length > 0) {
      await prisma.candidateSession.deleteMany({
        where: {
          accessKey: { in: accessKeys },
          interviewId: { in: interviewIds },
        },
      });
    }

    await prisma.cohort.delete({
      where: { id: cohortId },
    });

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } });
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.DELETE_COHORT,
      resource: "cohort",
      description: `Deleted cohort "${cohortName}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "Cohort deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting cohort:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete cohort",
      },
      { status: 500 }
    );
  }
}
