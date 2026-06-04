import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { verifySession } from "../../../../../lib/auth";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// POST /api/cohorts/[id]/interviews - Add interview to cohort
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const cohortId = id;

    // Verify session from cookie
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify session in database
    const session = await prisma.userSession.findUnique({
      where: { sessionId: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if session is expired (1 hour timeout)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeDiff > oneHour) {
      // Session expired, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    const { type, durationMinutes, instructions } = await request.json();

    // Validate required fields
    if (!type || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: "Type and duration are required" },
        { status: 400 }
      );
    }

    // Check if cohort exists
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Check if interview type already exists in this cohort
    const existingInterview = await prisma.cohortInterview.findFirst({
      where: {
        cohortId: cohortId,
        interview: {
          type: type,
        },
      },
    });

    if (existingInterview) {
      return NextResponse.json(
        {
          success: false,
          error: `An interview of type "${type}" already exists in this cohort`,
        },
        { status: 400 }
      );
    }

    // Create interview
    const interview = await prisma.interview.create({
      data: {
        type,
        instructions,
        durationMinutes: parseInt(durationMinutes),
        createdBy: session.user.id,
        isActive: true,
      },
    });

    // Link interview to cohort
    await prisma.cohortInterview.create({
      data: {
        cohortId: cohortId,
        interviewId: interview.id,
        interviewType: type,
      },
    });

    const actor = session.user;
    await createLog({
      actorType: "USER",
      userId: actor.id,
      actorName: actor.fullName,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: ACTION_TYPES.CREATE_INTERVIEW,
      resource: "interview",
      description: `Created ${type} interview in cohort "${cohort.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      interview: interview,
      message: "Interview added to cohort successfully",
    });
  } catch (error) {
    console.error("Error adding interview to cohort:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add interview to cohort",
      },
      { status: 500 }
    );
  }
}

// GET /api/cohorts/[id]/interviews - Get interviews for cohort
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cohortId = id;

    // Verify session from cookie
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify session in database
    const session = await prisma.userSession.findUnique({
      where: { sessionId: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      console.log(
        "GET /api/cohorts/[id]/interviews - Session verification failed: Invalid session"
      );
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if session is expired (1 hour timeout)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeDiff > oneHour) {
      // Session expired, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      console.log(
        "GET /api/cohorts/[id]/interviews - Session verification failed: Session expired"
      );
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    console.log(
      "GET /api/cohorts/[id]/interviews - Session verified for user:",
      session.user.email
    );

    // Get cohort interview IDs with explicit collation to avoid MySQL collation mismatch
    // (utf8mb4_0900_ai_ci vs utf8mb4_unicode_ci). Compare in a single collation.
    const idRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM cohort_interviews WHERE cohort_id COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci`,
      cohortId
    );
    const cohortInterviewIds = (idRows || []).map((row) => row.id).filter(Boolean);
    if (cohortInterviewIds.length === 0) {
      return NextResponse.json({ success: true, interviews: [] });
    }

    // Fetch full cohort interviews by ID (avoids passing cohortId in where)
    const interviews = await prisma.cohortInterview.findMany({
      where: { id: { in: cohortInterviewIds } },
      include: {
        interview: {
          include: {
            creator: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        cohort: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        interview: {
          createdAt: "desc",
        },
      },
    });

    return NextResponse.json({
      success: true,
      interviews: interviews.map((ci) => ({
        ...ci.interview,
        interviewType: ci.interviewType,
        // Interview is effectively active only if both interview and cohort are active
        isActive: ci.interview.isActive && ci.cohort.isActive,
        cohortActive: ci.cohort.isActive,
      })),
    });
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch interviews",
      },
      { status: 500 }
    );
  }
}
