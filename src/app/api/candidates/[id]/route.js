import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

// GET /api/candidates/[id] - Get candidate by ID with enrollments/cohorts (Admin only)
export async function GET(request, { params }) {
  try {
    const userRole = request.headers.get("x-user-role");
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            cohort: {
              select: {
                id: true,
                name: true,
                organisation: true,
                openTime: true,
                closeTime: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const data = {
      id: candidate.id,
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      isActive: candidate.isActive,
      createdAt: candidate.createdAt,
      enrollments: candidate.enrollments.map((e) => ({
        id: e.id,
        cohortId: e.cohortId,
        cohortName: e.cohort.name,
        organisation: e.cohort.organisation,
        openTime: e.cohort.openTime,
        closeTime: e.cohort.closeTime,
        isActive: e.cohort.isActive,
        status: e.status,
        accessKey: e.accessKey,
        enrolledAt: e.enrolledAt,
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching candidate:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidate", details: error.message },
      { status: 500 }
    );
  }
}
