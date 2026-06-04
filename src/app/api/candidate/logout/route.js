import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import candidateSessionManager from "../../../../lib/candidateSession";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

// POST /api/candidate/logout - Logout candidate
export async function POST(request) {
  try {
    const { candidateId, accessKey } = await request.json();

    if (!candidateId || !accessKey) {
      return NextResponse.json(
        { success: false, error: "Candidate ID and access key are required" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { fullName: true, email: true } });
    await candidateSessionManager.deactivateSession(candidateId, accessKey);
    if (candidate) {
      await createLog({
        actorType: "CANDIDATE",
        candidateId: candidate.id,
        actorName: candidate.fullName,
        actorEmail: candidate.email,
        actorRole: "CANDIDATE",
        actionType: ACTION_TYPES.CANDIDATE_LOGOUT,
        resource: "candidate",
        description: `Candidate "${candidate.fullName}" (${candidate.email}) logged out`,
        ...getRequestMeta(request),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error logging out candidate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to logout",
      },
      { status: 500 }
    );
  }
}
