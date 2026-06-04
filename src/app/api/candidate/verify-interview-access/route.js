import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// POST /api/candidate/verify-interview-access - Verify candidate has access to specific interview
export async function POST(request) {
  try {
    const { candidateId, accessKey, interviewId } = await request.json();

    if (!candidateId || !accessKey || !interviewId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

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

    // Check if interview is active
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { isActive: true },
    });

    if (!interview || !interview.isActive) {
      return NextResponse.json(
        { success: false, error: "Interview is not active" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Access verified",
    });
  } catch (error) {
    console.error("Error verifying interview access:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify interview access",
      },
      { status: 500 }
    );
  }
}
