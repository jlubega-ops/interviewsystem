import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../../lib/apiAuth";
import { invalidateCohort, invalidateEnrollment } from "../../../../../../../lib/cachedReads";
import { prisma } from "../../../../../../../lib/prisma";
import { validateAccessKeyChars } from "../../../../../../../lib/tokenUtils";

export const runtime = "nodejs";

// PATCH /api/cohorts/[id]/enrollments/[enrollmentId]/access-key - Update access key
export async function PATCH(request, { params }) {
  try {
    const { id, enrollmentId } = await params;
    const cohortId = id;
    const enrollmentIdInt = enrollmentId;

    const auth = await requireApiUser(request, {
      roles: ["ADMIN", "EXAMINER", "SUPERADMIN"],
    });
    if (auth.response) return auth.response;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const userEmail = auth.user.email;

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

    invalidateEnrollment(enrollment.accessKey);
    invalidateEnrollment(normalizedKey);
    invalidateCohort(cohortId);

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
