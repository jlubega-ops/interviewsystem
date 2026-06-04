import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  calculateTimeRemaining,
  logTimeValidation,
} from "../../../../lib/timeValidation";

export const runtime = "nodejs";

// POST /api/candidate/check-time - Check if attempt time has expired
export async function POST(request) {
  try {
    const { attemptId } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    // Get the attempt
    const attempt = await prisma.candidateSession.findUnique({
      where: { id: attemptId },
      include: {
        interview: {
          select: {
            durationMinutes: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { success: false, error: "Attempt is not in progress" },
        { status: 400 }
      );
    }

    // Calculate time remaining using server time only
    const timeData = calculateTimeRemaining(
      attempt.startedAt,
      attempt.interview.durationMinutes
    );

    // Log for security monitoring
    logTimeValidation(attemptId, timeData, "TIME_CHECK");

    if (timeData.isExpired) {
      // Time's up - tell client to auto-submit with current typed text.
      // Do NOT mark attempt COMPLETED here; let the client call submit-attempt
      // with the typed content so it gets saved before completion.
      return NextResponse.json({
        success: false,
        expired: true,
        message: "Time has expired",
      });
    }

    return NextResponse.json({
      success: true,
      timeRemaining: timeData.timeRemaining,
      expired: false,
    });
  } catch (error) {
    console.error("Error checking time:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check time",
      },
      { status: 500 }
    );
  }
}
