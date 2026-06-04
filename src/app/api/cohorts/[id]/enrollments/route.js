import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// GET /api/cohorts/[id]/enrollments - Fetch enrolled candidates
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cohortId = id;

    if (!cohortId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cohort ID",
        },
        { status: 400 }
      );
    }

    // Check if cohort exists
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return NextResponse.json(
        {
          success: false,
          error: "Cohort not found",
        },
        { status: 404 }
      );
    }

    // Fetch enrollments
    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId: cohortId },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        enrolledAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      enrollments: enrollments,
    });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch enrollments",
      },
      { status: 500 }
    );
  }
}
