import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { invalidateInterview } from "../../../../../lib/cachedReads";

export const runtime = "nodejs";

// PUT /api/interviews/[id]/toggle-visibility - Toggle interview visibility
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const interviewId = id;

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

    // Get current interview status
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { isHidden: true },
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Toggle visibility
    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: { isHidden: !interview.isHidden },
    });

    invalidateInterview(interviewId);

    return NextResponse.json({
      success: true,
      interview: updatedInterview,
      message: `Interview ${
        updatedInterview.isHidden ? "hidden" : "shown"
      } successfully`,
    });
  } catch (error) {
    console.error("Error toggling interview visibility:", error);
    return NextResponse.json(
      { success: false, error: "Failed to toggle interview visibility" },
      { status: 500 }
    );
  }
}
