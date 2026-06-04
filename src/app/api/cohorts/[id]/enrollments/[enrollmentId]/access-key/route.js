import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { validateAccessKeyChars } from "../../../../../../../lib/tokenUtils";

export const runtime = "nodejs";

// PATCH /api/cohorts/[id]/enrollments/[enrollmentId]/access-key - Update access key
export async function PATCH(request, { params }) {
  try {
    const { id, enrollmentId } = await params;
    const cohortId = id;
    const enrollmentIdInt = enrollmentId;

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

    // Check if user has permission to update access keys
    if (!["ADMIN", "EXAMINER", "SUPERADMIN"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { accessKey } = await request.json();

    if (!accessKey || !accessKey.trim()) {
      return NextResponse.json(
        { success: false, error: "Access key is required" },
        { status: 400 }
      );
    }

    const validation = validateAccessKeyChars(accessKey.trim());
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const normalizedKey = accessKey.trim().toUpperCase();

    // Check if enrollment exists
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        id: enrollmentIdInt,
        cohortId: cohortId,
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: "Enrollment not found" },
        { status: 404 }
      );
    }

    // Check if access key is already in use by another enrollment
    const existingEnrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        accessKey: normalizedKey,
        id: { not: enrollmentIdInt },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { success: false, error: "Access key is already in use" },
        { status: 400 }
      );
    }

    // Update the access key
    const updatedEnrollment = await prisma.cohortEnrollment.update({
      where: { id: enrollmentIdInt },
      data: { accessKey: normalizedKey },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Access key updated successfully",
      enrollment: updatedEnrollment,
    });
  } catch (error) {
    console.error("Error updating access key:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update access key",
      },
      { status: 500 }
    );
  }
}
