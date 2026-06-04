import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger.js";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";
import { calculateTimeRemaining } from "../../../../lib/timeValidation.js";

export const runtime = "nodejs";

// POST /api/candidate/start-attempt - Start a new interview attempt
export async function POST(request) {
  try {
    const { candidateId, interviewId, accessKey } = await request.json();

    logger.candidate("🎯 Start attempt request", {
      candidateId,
      interviewId,
      accessKey: accessKey?.substring(0, 8) + "...",
    });

    if (!candidateId || !interviewId || !accessKey) {
      logger.candidate("❌ Start attempt failed: Missing required fields", {
        candidateId: !!candidateId,
        interviewId: !!interviewId,
        accessKey: !!accessKey,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Candidate ID, Interview ID, and Access Key are required",
        },
        { status: 400 }
      );
    }

    // Check if interview exists and is active
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!interview) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidateId ?? null,
        actorName: null,
        actorEmail: null,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_INTERVIEW_START_FAILED,
        resource: "interview",
        description: "Candidate interview start failed: interview not found",
        targetInterviewId: interviewId,
        targetInterviewType: null,
        ...getRequestMeta(request),
      });
      return NextResponse.json(
        { success: false, error: "Interview not found" },
        { status: 404 }
      );
    }

    // Get candidate details early for logging
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "Candidate not found" },
        { status: 404 }
      );
    }

    if (!interview.isActive) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate.id,
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_INTERVIEW_START_FAILED,
        resource: "interview",
        description: `Candidate "${candidate.fullName}" interview start failed: interview not active`,
        targetInterviewId: interviewId,
        targetInterviewType: interview?.type ?? null,
        ...getRequestMeta(request),
      });
      return NextResponse.json(
        { success: false, error: "Interview is not active" },
        { status: 400 }
      );
    }

    // Verify enrollment

    // Verify that the candidate is enrolled in a cohort that contains this interview
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        candidateId: candidateId,
        accessKey: accessKey,
        status: "ENROLLED",
      },
      include: {
        cohort: {
          include: {
            interviews: {
              where: {
                interviewId: interviewId,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate?.id ?? null,
        actorName: candidate?.fullName ?? null,
        actorEmail: candidate?.email ?? null,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_INTERVIEW_START_FAILED,
        resource: "interview",
        description: `Candidate "${candidate?.fullName}" interview start failed: invalid access or not enrolled`,
        targetInterviewId: interviewId,
        targetInterviewType: interview?.type ?? null,
        ...getRequestMeta(request),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Invalid access or not enrolled in this cohort",
        },
        { status: 403 }
      );
    }

    if (enrollment.cohort.interviews.length === 0) {
      return NextResponse.json(
        { success: false, error: "Interview not available in your cohort" },
        { status: 403 }
      );
    }

    // Check if candidate has ANY attempt for this interview (any status)
    // Get ALL attempts first to see what exists
    const allAttempts = await prisma.candidateSession.findMany({
      where: {
        accessKey: accessKey,
        interviewId: interviewId,
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    console.log("All existing attempts for this interview:", {
      accessKey,
      interviewId,
      attempts: allAttempts.map((a) => ({
        id: a.id,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      })),
    });

    // Get the most recent attempt
    const existingAttempt = allAttempts.length > 0 ? allAttempts[0] : null;

    console.log(
      "Most recent attempt:",
      existingAttempt
        ? {
            id: existingAttempt.id,
            status: existingAttempt.status,
            completedAt: existingAttempt.completedAt,
          }
        : null
    );

    if (existingAttempt) {
      if (existingAttempt.status === "IN_PROGRESS") {
        // Instead of error, return the existing attempt details for resume
        return NextResponse.json({
          success: true,
          attemptId: existingAttempt.id,
          message: "Resuming existing attempt",
          isResume: true,
        });
      } else if (existingAttempt.status === "COMPLETED") {
        return NextResponse.json(
          {
            success: false,
            error: "You have already completed this interview",
          },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "You already have an attempt for this interview",
          },
          { status: 400 }
        );
      }
    }

    // Create new attempt with IN_PROGRESS status
    const attempt = await prisma.candidateSession.create({
      data: {
        interviewId: interviewId,
        candidateName: candidate.fullName,
        candidateEmail: candidate.email,
        accessKey: accessKey,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        totalQuestions: interview.questions.length,
        leaveAttempts: 5, // Initialize with 5 attempts
      },
    });

    // Questions and options in original order (no shuffle).
    const finalQuestions = interview.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(JSON.stringify(q.options)) : [],
    }));

    logger.candidate("✅ Attempt started successfully", {
      attemptId: attempt.id,
      candidateId,
      interviewId,
      questionsCount: finalQuestions.length,
      durationMinutes: interview.durationMinutes,
    });
    await createLog({
      actorType: "CANDIDATE",
      candidateId: candidate.id,
      actorName: candidate.fullName,
      actorEmail: candidate.email,
      actorRole: "CANDIDATE",
      actionType: ACTION_TYPES.CANDIDATE_STARTED_INTERVIEW,
      resource: "interview",
      description: `Candidate "${candidate.fullName}" started ${interview.type} interview (ID: ${interviewId})`,
      targetCohortId: enrollment?.cohort?.id ?? null,
      targetCohortName: enrollment?.cohort?.name ?? null,
      targetInterviewId: interviewId,
      targetInterviewType: interview?.type ?? null,
      ...getRequestMeta(request),
    });

    const timeData = calculateTimeRemaining(attempt.startedAt, interview.durationMinutes);
    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      questions: finalQuestions,
      durationMinutes: interview.durationMinutes,
      startedAt: attempt.startedAt,
      serverTime: timeData.serverNow.getTime(),
      timeRemaining: timeData.timeRemaining,
    });
  } catch (error) {
    logger.error("❌ Error starting attempt", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start interview attempt",
      },
      { status: 500 }
    );
  }
}
