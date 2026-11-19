import { NextResponse } from "next/server";
import { calculateTimeRemaining } from "../../../../lib/timeValidation";
import { requireOwnedAttempt } from "../../../../lib/candidateAuth";
import { getInterviewWithQuestions } from "../../../../lib/cachedReads";

export const runtime = "nodejs";

// POST /api/candidate/check-time - Check if attempt time has expired
export async function POST(request) {
  try {
    const { attemptId, accessKey, candidateId } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const owned = await requireOwnedAttempt({
      attemptId,
      accessKey,
      candidateId,
      requireInProgress: true,
    });
    if (owned.error) return owned.error;
    const attempt = owned.attempt;

    const interview = await getInterviewWithQuestions(attempt.interviewId);
    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Calculate time remaining using server time only
    const timeData = calculateTimeRemaining(
      attempt.startedAt,
      interview.durationMinutes
    );

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
