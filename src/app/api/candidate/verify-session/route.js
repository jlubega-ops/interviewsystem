import { NextResponse } from "next/server";
import candidateSessionManager from "../../../../lib/candidateSession";
import { prisma } from "../../../../lib/prisma";
import { requireEnrollment } from "../../../../lib/candidateAuth";

export const runtime = "nodejs";

// POST /api/candidate/verify-session - Verify candidate session
export async function POST(request) {
  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Request body is required" },
        { status: 400 }
      );
    }

    const { candidateId, accessKey } = JSON.parse(body);

    if (!candidateId || !accessKey) {
      return NextResponse.json(
        { success: false, error: "Candidate ID and access key are required" },
        { status: 400 }
      );
    }

    const owned = await requireEnrollment({ candidateId, accessKey });
    if (owned.error) return owned.error;

    // Verify session
    const sessionResult = await candidateSessionManager.verifySession(
      candidateId,
      accessKey
    );

    if (!sessionResult.valid) {
      return NextResponse.json(
        { success: false, error: sessionResult.reason },
        { status: 401 }
      );
    }

    // Ensure cohort is still published (admin may have unpublished since login)
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { accessKey },
      select: { cohortId: true },
    });
    if (enrollment) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          "SELECT is_published FROM cohorts WHERE id = ? LIMIT 1",
          enrollment.cohortId
        );
        const row = rows?.[0];
        if (row) {
          const val = row.is_published ?? row.Is_Published;
          const isPublished = typeof val === "number" ? val !== 0 : Boolean(val);
          if (!isPublished) {
            return NextResponse.json(
              {
                success: false,
                error: "This cohort is not available for attempts yet. Please contact your examiner or administrator.",
              },
              { status: 403 }
            );
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      message: "Session is valid",
    });
  } catch (error) {
    console.error("Error verifying candidate session:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify session",
      },
      { status: 500 }
    );
  }
}
