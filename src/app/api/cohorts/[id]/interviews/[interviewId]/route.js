import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { verifySession } from "../../../../../../lib/auth";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// PUT /api/cohorts/[id]/interviews/[interviewId] - Update interview
export async function PUT(request, { params }) {
  try {
    const { id, interviewId: interviewIdParam } = await params;
    const cohortId = id;
    const interviewId = interviewIdParam;

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

    const { action } = await request.json();

    // Check if interview exists in this cohort
    const cohortInterview = await prisma.cohortInterview.findFirst({
      where: {
        cohortId: cohortId,
        interviewId: interviewId,
      },
      include: {
        interview: true,
      },
    });

    if (!cohortInterview) {
      return NextResponse.json(
        { success: false, error: "Interview not found in this cohort" },
        { status: 404 }
      );
    }

    let updateData = {};
    let message = "";

    switch (action) {
      case "hide":
        updateData = { isHidden: true };
        message = "Interview hidden successfully";
        break;
      case "unhide":
        updateData = { isHidden: false };
        message = "Interview unhidden successfully";
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update interview
    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: updateData,
    });

    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } });
    const actor = session.user;
    await createLog({
      actorType: "USER",
      userId: actor.id,
      actorName: actor.fullName,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: ACTION_TYPES.TOGGLE_INTERVIEW_VISIBILITY,
      resource: "interview",
      description: `${action === "hide" ? "Hidden" : "Unhidden"} ${cohortInterview.interview.type} interview in cohort "${cohort?.name ?? cohortId}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      interview: updatedInterview,
      message: message,
    });
  } catch (error) {
    console.error("Error updating interview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update interview",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cohorts/[id]/interviews/[interviewId] - Delete interview
export async function DELETE(request, { params }) {
  try {
    const { id, interviewId: interviewIdParam } = await params;
    const cohortId = id;
    const interviewId = interviewIdParam;

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

    // Check if interview exists in this cohort
    const cohortInterview = await prisma.cohortInterview.findFirst({
      where: {
        cohortId: cohortId,
        interviewId: interviewId,
      },
      include: {
        interview: true,
      },
    });

    if (!cohortInterview) {
      return NextResponse.json(
        { success: false, error: "Interview not found in this cohort" },
        { status: 404 }
      );
    }

    // Only admin or the user who created the interview can delete it.
    const interview = cohortInterview.interview;
    const isAdmin = session.user.role === "SUPERADMIN" || session.user.role === "ADMIN";
    const isCreator = interview.createdBy === session.user.id;
    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { success: false, error: "Only an admin or the examiner who created this interview can delete it." },
        { status: 403 }
      );
    }

    // Cascade: delete all attempts for this interview in this cohort (sessions with cohort's accessKeys + this interviewId)
    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId },
      select: { accessKey: true },
    });
    const accessKeys = enrollments.map((e) => e.accessKey);
    if (accessKeys.length > 0) {
      await prisma.candidateSession.deleteMany({
        where: {
          accessKey: { in: accessKeys },
          interviewId: interviewId,
        },
      });
    }

    // Remove interview from cohort
    const interviewType = cohortInterview.interview.type;
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { name: true } });
    await prisma.cohortInterview.delete({
      where: {
        id: cohortInterview.id,
      },
    });

    // Delete the global Interview only if it is not used in any other cohort (candidate can belong to many cohorts)
    const otherCohortLink = await prisma.cohortInterview.findFirst({
      where: { interviewId },
    });
    if (!otherCohortLink) {
      await prisma.interview.delete({
        where: { id: interviewId },
      });
    }

    const actor = session.user;
    await createLog({
      actorType: "USER",
      userId: actor.id,
      actorName: actor.fullName,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: ACTION_TYPES.DELETE_INTERVIEW,
      resource: "interview",
      description: `Deleted ${interviewType} interview from cohort "${cohort?.name ?? cohortId}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      message: "Interview deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting interview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete interview",
      },
      { status: 500 }
    );
  }
}
