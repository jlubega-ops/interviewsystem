import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

// GET /api/interviews/[id] - Get interview details
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    // Interview ID received

    // Get user info from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const userEmail = request.headers.get("x-user-email");

    // User info from middleware headers

    if (!userId || !userRole) {
      // No user info in headers
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to view interviews
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      // Insufficient permissions
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Authentication successful

    // Get interview with questions and cohort through CohortInterview
    // Fetching interview
    const interview = await prisma.interview.findUnique({
      where: { id: id },
      include: {
        cohortInterviews: {
          include: {
            cohort: {
              select: {
                id: true,
                name: true,
                openTime: true,
                closeTime: true,
              },
            },
          },
        },
        questions: {
          orderBy: { id: "asc" },
        },
      },
    });

    // Interview query completed
    if (!interview) {
      // Interview not found
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Format the response to include cohort information
    const formattedInterview = {
      ...interview,
      cohort: interview.cohortInterviews?.[0]?.cohort || null,
    };

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_INTERVIEW,
      resource: "interview",
      description: `Viewed interview "${interview.type}" (ID: ${id})`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({
      success: true,
      interview: formattedInterview,
    });
  } catch (error) {
    console.error("Error fetching interview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch interview" },
      { status: 500 }
    );
  }
}

// PATCH /api/interviews/[id] - Update interview
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get user info from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const userEmail = request.headers.get("x-user-email");

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to update interviews
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Check if interview exists
    const existingInterview = await prisma.interview.findUnique({
      where: { id: id },
    });

    if (!existingInterview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    let updateData = {};
    let message = "";

    // Handle different update types
    if (body.action) {
      // Simple action-based updates (hide/unhide)
      switch (body.action) {
        case "hide":
          updateData = { isHidden: true };
          message = "Interview hidden successfully";
          break;
        case "unhide":
          updateData = { isHidden: false };
          message = "Interview shown successfully";
          break;
        default:
          return NextResponse.json(
            { success: false, error: "Invalid action" },
            { status: 400 }
          );
      }
    } else {
      // Full interview update
      const { description, instructions, type, durationMinutes, isActive } =
        body;

      // Validate required fields
      if (!description || !instructions || !type || !durationMinutes) {
        return NextResponse.json(
          {
            success: false,
            error: "Description, instructions, type, and duration are required",
          },
          { status: 400 }
        );
      }

      // Validate duration (must be positive)
      if (durationMinutes <= 0) {
        return NextResponse.json(
          { success: false, error: "Duration must be greater than 0" },
          { status: 400 }
        );
      }

      // Validate type
      const validTypes = ["APTITUDE", "TYPING", "ORAL"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: "Invalid interview type" },
          { status: 400 }
        );
      }

      updateData = {
        description: description.trim(),
        instructions: instructions.trim(),
        type: type,
        durationMinutes: parseInt(durationMinutes),
        isActive: Boolean(isActive),
      };

      message = "Interview updated successfully";
    }

    const updatedInterview = await prisma.interview.update({
      where: { id: id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message,
      interview: updatedInterview,
    });
  } catch (error) {
    console.error("Error updating interview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update interview" },
      { status: 500 }
    );
  }
}
