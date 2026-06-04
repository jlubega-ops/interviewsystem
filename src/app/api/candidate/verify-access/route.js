import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import candidateSessionManager from "../../../../lib/candidateSession";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

// POST /api/candidate/verify-access - Verify candidate access key
export async function POST(request) {
  try {
    const { accessKey } = await request.json();

    if (!accessKey) {
      return NextResponse.json(
        { success: false, error: "Access key is required" },
        { status: 400 }
      );
    }

    // Find candidate by access key (any enrollment status so we can return clear messages)
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: { accessKey: accessKey },
      include: {
        candidate: true,
        cohort: {
          include: {
            interviews: {
              include: {
                interview: {
                  select: {
                    id: true,
                    type: true,
                    durationMinutes: true,
                    instructions: true,
                    totalQuestions: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: "Invalid access key" },
        { status: 404 }
      );
    }

    const candidate = enrollment.candidate;

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Invalid access key" },
        { status: 404 }
      );
    }

    // Clear message when candidate record is suspended (inactive)
    if (!candidate.isActive) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate.id,
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LOGIN_FAILED,
        resource: "candidate",
        description: `Candidate "${candidate.fullName}" login failed: access suspended`,
        targetCohortId: enrollment.cohort?.id,
        targetCohortName: enrollment.cohort?.name,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent")?.substring(0, 500) ?? null,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Your access has been suspended. Please contact support.",
        },
        { status: 403 }
      );
    }

    // Clear message when enrollment is suspended (UNENROLLED) for this cohort
    if (enrollment.status !== "ENROLLED") {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate.id,
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LOGIN_FAILED,
        resource: "candidate",
        description: `Candidate "${candidate.fullName}" login failed: enrollment suspended (status ${enrollment.status})`,
        targetCohortId: enrollment.cohort?.id,
        targetCohortName: enrollment.cohort?.name,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent")?.substring(0, 500) ?? null,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Your access to this cohort has been suspended. Please contact your examiner or administrator.",
        },
        { status: 403 }
      );
    }

    // Check if cohort is active
    if (!enrollment.cohort.isActive) {
      await createLog({
        actorType: "CANDIDATE",
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LOGIN_FAILED,
        resource: "candidate",
        description: `Candidate "${candidate.fullName}" login failed: cohort not active`,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent")?.substring(0, 500) ?? null,
      });
      return NextResponse.json(
        { success: false, error: "Cohort is not active" },
        { status: 400 }
      );
    }

    // Check if cohort is published (read from DB so it's reliable)
    let cohortIsPublished = enrollment.cohort.isPublished;
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT is_published FROM cohorts WHERE id = ? LIMIT 1",
        enrollment.cohort.id
      );
      const row = rows?.[0];
      if (row && (row.is_published !== undefined || row.Is_Published !== undefined)) {
        const val = row.is_published ?? row.Is_Published;
        cohortIsPublished = typeof val === "number" ? val !== 0 : Boolean(val);
      }
    } catch (_) {}

    if (!cohortIsPublished) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate.id,
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LOGIN_FAILED,
        resource: "candidate",
        description: `Candidate "${candidate.fullName}" login failed: cohort not published yet`,
        targetCohortId: enrollment.cohort?.id,
        targetCohortName: enrollment.cohort?.name,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent")?.substring(0, 500) ?? null,
      });
      return NextResponse.json(
        {
          success: false,
          error: "This cohort is not available for attempts yet. Please contact your examiner or administrator.",
        },
        { status: 403 }
      );
    }

    // Get client information
    const userAgent = request.headers.get("user-agent") || "";
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check if session already exists
    let session = await prisma.candidateSession.findFirst({
      where: {
        accessKey: enrollment.accessKey,
        status: { in: ["STARTED", "IN_PROGRESS"] },
      },
    });

    // Only create new session if none exists
    if (!session) {
      session = await candidateSessionManager.createSession(
        candidate.id,
        enrollment.accessKey,
        userAgent,
        ipAddress,
        candidate.email
      );
    }

    await createLog({
      actorType: "CANDIDATE",
      candidateId: candidate.id,
      actorName: candidate.fullName,
      actorEmail: candidate.email,
      actorRole: "CANDIDATE",
      actionType: ACTION_TYPES.CANDIDATE_LOGIN_SUCCESS,
      resource: "candidate",
      description: `Candidate "${candidate.fullName}" (${candidate.email}) logged in with access key`,
      targetCohortId: enrollment.cohort?.id,
      targetCohortName: enrollment.cohort?.name,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent")?.substring(0, 500) ?? null,
    });

    // Include resultsPublished on cohort so candidate UI can show/hide results
    let resultsPublished = enrollment.cohort?.resultsPublished === true;
    try {
      const rpRows = await prisma.$queryRawUnsafe(
        "SELECT results_published FROM cohorts WHERE id = ? LIMIT 1",
        enrollment.cohort.id
      );
      const rpRow = rpRows?.[0];
      if (rpRow && (rpRow.results_published !== undefined || rpRow.Results_Published !== undefined)) {
        const val = rpRow.results_published ?? rpRow.Results_Published;
        resultsPublished = typeof val === "number" ? val !== 0 : Boolean(val);
      }
    } catch (_) {}
    const cohortForCandidate = { ...enrollment.cohort, resultsPublished };

    return NextResponse.json({
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        accessKey: enrollment.accessKey,
        sessionId: session.id,
        enrollments: [
          {
            id: enrollment.id,
            cohort: cohortForCandidate,
            status: enrollment.status,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error verifying access key:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify access key",
      },
      { status: 500 }
    );
  }
}
