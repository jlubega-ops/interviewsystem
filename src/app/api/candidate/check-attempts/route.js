import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireEnrollment } from "../../../../lib/candidateAuth";
import { readCohortResultFlags } from "../../../../lib/resultsPublish";

export const runtime = "nodejs";

// POST /api/candidate/check-attempts - Check which interviews have been attempted
export async function POST(request) {
  try {
    // Check Content-Type and handle JSON parsing errors
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { candidateId, accessKey, interviewIds } = requestData;

    if (!candidateId || !accessKey || !interviewIds) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const owned = await requireEnrollment({ candidateId, accessKey });
    if (owned.error) return owned.error;

    let resultFlags = {
      resultsPublished: false,
      resultsShowAttempt: false,
      resultsShowCorrect: false,
    };
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { accessKey },
      select: { cohortId: true },
    });
    if (enrollment) {
      resultFlags = await readCohortResultFlags(prisma, enrollment.cohortId);
    }
    const resultsPublished = resultFlags.resultsPublished;

    // Find all attempts for this candidate and access key (completed, in progress)
    const attempts = await prisma.candidateSession.findMany({
      where: {
        accessKey: accessKey,
        interviewId: { in: interviewIds },
        status: { in: ["COMPLETED", "IN_PROGRESS"] },
      },
      select: {
        interviewId: true,
        status: true,
        score: true,
        completedAt: true,
        startedAt: true,
        submissionReason: true,
      },
    });

    // Convert to object for easy lookup; hide score when results not published
    const attemptsMap = {};
    attempts.forEach((attempt) => {
      attemptsMap[attempt.interviewId] = {
        status: attempt.status,
        score: resultsPublished ? attempt.score : null,
        completedAt: attempt.completedAt,
        submissionReason: attempt.submissionReason ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      attempts: attemptsMap,
      ...resultFlags,
    });
  } catch (error) {
    console.error("Error checking interview attempts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check interview attempts",
      },
      { status: 500 }
    );
  }
}
