import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { validateInput, sanitizeUserInput, sanitizeHtml } from "../../../lib/sanitize";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../lib/activityLog.js";
import { requireApiUser } from "../../../lib/apiAuth";
import { assertOrganisationName } from "../../../lib/organisations";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// GET /api/cohorts - Fetch all cohorts (admin: all; examiner: only assigned)
export async function GET(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const isExaminer = userRole === "EXAMINER";
    const where = isExaminer
      ? { examiners: { some: { userId } } }
      : {};

    const cohorts = await prisma.cohort.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        examiners: {
          select: {
            user: {
              select: {
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        enrollments: {
          select: {
            id: true,
            status: true,
            enrolledAt: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    const transformedCohorts = cohorts.map((cohort) => {
      const examinerNames = (cohort.examiners || []).map((e) => {
        const u = e.user;
        return u?.fullName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "—";
      });
      return {
        ...cohort,
        enrollmentCount: cohort.enrollments?.length ?? 0,
        interviewCount: cohort.interviews?.length ?? 0,
        examinerNames,
      };
    });

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_COHORTS,
      resource: "cohort",
      description: "Viewed cohorts list",
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      cohorts: transformedCohorts,
    });
  } catch (error) {
    console.error("Error fetching cohorts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cohorts",
      },
      { status: 500 }
    );
  }
}

// POST /api/cohorts - Create cohort (admin: must provide organisation; examiner: allowed, auto-assigned and org from profile)
export async function POST(request) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const body = await request.json();
    const { name, description, instructions, openTime, closeTime, organisation } = body;
    const isExaminer = userRole === "EXAMINER";

    // Validate and sanitize input
    let sanitizedName, sanitizedDescription, sanitizedInstructions;

    try {
      const validatedName = validateInput.nonEmptyString(name, "Cohort name");
      sanitizedName = sanitizeUserInput(validatedName);

      if (!openTime || !closeTime) {
        return NextResponse.json(
          {
            success: false,
            error: "Open time and close time are required",
          },
          { status: 400 }
        );
      }

      // Sanitize optional fields
      sanitizedDescription = description ? sanitizeHtml(description) : null;
      sanitizedInstructions = instructions ? sanitizeHtml(instructions) : null;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    // Validate dates
    const openDate = new Date(openTime);
    const closeDate = new Date(closeTime);

    if (openDate >= closeDate) {
      return NextResponse.json(
        { success: false, error: "Close time must be after open time" },
        { status: 400 }
      );
    }

    let cohortOrganisation = null;
    if (isExaminer) {
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: { organisation: true },
      });
      cohortOrganisation = creator?.organisation?.trim() || null;
    } else {
      if (!organisation || typeof organisation !== "string" || !organisation.trim()) {
        return NextResponse.json(
          { success: false, error: "Organisation is required when creating a cohort as admin" },
          { status: 400 }
        );
      }
      const orgCheck = await assertOrganisationName(organisation, {
        required: true,
      });
      if (orgCheck.error) {
        return NextResponse.json(
          { success: false, error: orgCheck.error },
          { status: 400 }
        );
      }
      cohortOrganisation = orgCheck.name;
    }

    const cohort = await prisma.cohort.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        instructions: sanitizedInstructions,
        organisation: cohortOrganisation,
        openTime: openDate,
        closeTime: closeDate,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (isExaminer) {
      await prisma.cohortExaminer.create({
        data: { cohortId: cohort.id, userId },
      });
    }

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } });
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: actor?.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.CREATE_COHORT,
      resource: "cohort",
      description: `Created cohort "${cohort.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      cohort,
      message: "Cohort created successfully" + (isExaminer ? ". You have been assigned as examiner." : ""),
    });
  } catch (error) {
    console.error("Error creating cohort:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create cohort",
      },
      { status: 500 }
    );
  }
}
