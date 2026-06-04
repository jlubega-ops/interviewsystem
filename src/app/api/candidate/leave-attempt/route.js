import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

// POST /api/candidate/leave-attempt - Handle page leave attempt
export async function POST(request) {
  try {
    const { attemptId } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    // Get current attempt
    const attempt = await prisma.candidateSession.findUnique({
      where: { id: attemptId },
      include: { interview: { select: { type: true } } },
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

    // Decrease leave attempts
    const newLeaveAttempts = attempt.leaveAttempts - 1;

    if (newLeaveAttempts <= 0) {
      // No more attempts - submit automatically
      await prisma.candidateSession.update({
        where: { id: attemptId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          leaveAttempts: 0,
        },
      });
      await createLog({
        actorType: "CANDIDATE",
        actorName: attempt.candidateName,
        actorEmail: attempt.candidateEmail ?? null,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LEFT_SCREEN,
        resource: "interview",
        description: `Candidate "${attempt.candidateName}" left interview screen - auto-submitted (no tries remaining).`,
        targetInterviewId: attempt.interviewId,
        targetInterviewType: attempt.interview?.type ?? null,
        ...getRequestMeta(request),
      });
      return NextResponse.json({
        success: true,
        submitted: true,
        message:
          "You have run out of tries for leaving the page. Your attempt has been submitted.",
        leaveAttempts: 0,
      });
    } else {
      // Update leave attempts
      await prisma.candidateSession.update({
        where: { id: attemptId },
        data: {
          leaveAttempts: newLeaveAttempts,
        },
      });
      await createLog({
        actorType: "CANDIDATE",
        actorName: attempt.candidateName,
        actorEmail: attempt.candidateEmail ?? null,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LEFT_SCREEN,
        resource: "interview",
        description: `Candidate "${attempt.candidateName}" left interview screen (${attempt.interview?.type ?? "interview"}). ${newLeaveAttempts} tries remaining.`,
        targetInterviewId: attempt.interviewId,
        targetInterviewType: attempt.interview?.type ?? null,
        ...getRequestMeta(request),
      });
      return NextResponse.json({
        success: true,
        submitted: false,
        message: `You have ${newLeaveAttempts} tries left for leaving the page.`,
        leaveAttempts: newLeaveAttempts,
      });
    }
  } catch (error) {
    console.error("Error handling leave attempt:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to handle leave attempt",
      },
      { status: 500 }
    );
  }
}
