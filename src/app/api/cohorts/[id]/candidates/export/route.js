import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// GET /api/cohorts/[id]/candidates/export - Export candidates to Excel
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cohortId = id;

    // Get user info from headers (set by middleware)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const userEmail = request.headers.get("x-user-email");

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to export candidates
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get cohort details
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return NextResponse.json(
        { success: false, error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Get all enrollments for this cohort
    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId: cohortId },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        enrolledAt: "desc",
      },
    });

    // Create CSV content
    const csvHeaders = [
      "Candidate ID",
      "Full Name",
      "Email",
      "Phone",
      "Status",
      "Access Key",
      "Enrolled Date",
      "Is Active",
    ];

    const csvRows = enrollments.map((enrollment) => [
      enrollment.candidate.id,
      enrollment.candidate.fullName,
      enrollment.candidate.email,
      enrollment.candidate.phone || "Not provided",
      enrollment.status,
      enrollment.accessKey,
      new Date(enrollment.enrolledAt).toLocaleString(),
      enrollment.candidate.isActive ? "Yes" : "No",
    ]);

    // Combine headers and rows
    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Create filename with cohort name and current date
    const cohortName = cohort.name.replace(/[^a-zA-Z0-9]/g, "_");
    const currentDate = new Date().toISOString().split("T")[0];
    const filename = `${cohortName}_candidates_${currentDate}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting candidates:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export candidates",
      },
      { status: 500 }
    );
  }
}
