import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../../lib/apiAuth";
import { invalidateCohort } from "../../../../../lib/cachedReads";
import { prisma } from "../../../../../lib/prisma";
import { ACCESS_KEY_SAFE_CHARS } from "../../../../../lib/tokenUtils";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// POST /api/cohorts/[id]/enroll - Enroll a candidate in a cohort
export async function POST(request, { params }) {
  try {
    const auth = await requireApiUser(request);
    if (auth.response) return auth.response;
    const { id } = await params;
    const cohortId = id;
    const body = await request.json();
    const { name, email, phone } = body;

    if (!cohortId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cohort ID",
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Name and email are required",
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

    // Check if candidate with email exists
    const existingCandidate = await prisma.candidate.findFirst({
      where: { email: email },
    });

    let candidateId;
    let isNewCandidate = false;

    if (existingCandidate) {
      // Check if names match
      if (existingCandidate.fullName.toLowerCase() !== name.toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: "CANDIDATE_EXISTS_DIFFERENT_NAME",
            existingCandidate: {
              name: existingCandidate.fullName,
              email: existingCandidate.email,
              phone: existingCandidate.phone || "Not provided",
            },
          },
          { status: 400 }
        );
      }
      candidateId = existingCandidate.id;
    } else {
      // Create new candidate
      const newCandidate = await prisma.candidate.create({
        data: {
          email: email,
          fullName: name,
          phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
          isActive: true,
        },
      });

      candidateId = newCandidate.id;
      isNewCandidate = true;
    }

    // Check if candidate is already enrolled in this cohort
    const existingEnrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        cohortId: cohortId,
        candidateId: candidateId,
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "Candidate is already enrolled in this cohort",
        },
        { status: 400 }
      );
    }

    // Generate unique access key
    const accessKey = await generateUniqueAccessKey();

    // Create enrollment
    const enrollment = await prisma.cohortEnrollment.create({
      data: {
        cohortId: cohortId,
        candidateId: candidateId,
        accessKey: accessKey,
        status: "ENROLLED",
        enrolledAt: new Date(),
      },
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
    });

    const actorId = auth.user.id;
    const actorRole = auth.user.role;
    const actorEmail = auth.user.email;
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId: actorId,
      actorName: actor?.fullName ?? null,
      actorEmail: actorEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: actorRole ?? null,
      actionType: ACTION_TYPES.ASSIGN_CANDIDATE,
      resource: "cohort",
      description: `Assigned candidate "${enrollment.candidate.fullName}" (${enrollment.candidate.email}) to cohort "${cohort.name}" with access key`,
      ...getRequestMeta(request),
    });

    invalidateCohort(cohortId);

    return NextResponse.json({
      success: true,
      candidate: enrollment,
      isNewCandidate: isNewCandidate,
      message: "Candidate enrolled successfully",
    });
  } catch (error) {
    console.error("Error enrolling candidate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to enroll candidate",
      },
      { status: 500 }
    );
  }
}

// Generate unique access key with format MUBEIIC/2025/XXXXXX (unambiguous chars only)
async function generateUniqueAccessKey() {
  const currentYear = new Date().getFullYear();
  const prefix = "MUBEIIC";
  const year = currentYear.toString();

  let accessKey;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += ACCESS_KEY_SAFE_CHARS.charAt(
        Math.floor(Math.random() * ACCESS_KEY_SAFE_CHARS.length)
      );
    }
    accessKey = `${prefix}/${year}/${suffix}`;

    // Check if access key already exists
    const existingKey = await prisma.cohortEnrollment.findFirst({
      where: { accessKey: accessKey },
    });

    if (!existingKey) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new Error("Unable to generate unique access key");
  }

  return accessKey;
}
