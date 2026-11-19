import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request) {
  try {
    const auth = await requireApiUser(request, {
      roles: ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    });
    if (auth.response) return auth.response;

    // Get current date for today's calculations
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    // Get total interviews
    const totalInterviews = await prisma.interview.count();

    // Get active interviews (not hidden)
    const activeInterviews = await prisma.interview.count({
      where: {
        isHidden: false,
        isActive: true,
      },
    });

    // Get completed sessions today
    const completedToday = await prisma.candidateSession.count({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    });

    const totalCandidates = await prisma.candidate.count();

    const enrolledCandidates = await prisma.cohortEnrollment.count({
      where: { status: "ENROLLED" },
    });

    const totalCohorts = await prisma.cohort.count();

    const now = new Date();
    const activeCohorts = await prisma.cohort.count({
      where: {
        isActive: true,
        openTime: { lte: now },
        closeTime: { gte: now },
      },
    });

    // Get total questions across all interviews
    const totalQuestions = await prisma.question.count();

    const sessionsInProgress = await prisma.candidateSession.count({
      where: {
        status: { in: ["STARTED", "IN_PROGRESS"] },
      },
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSessions = await prisma.candidateSession.count({
      where: {
        startedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get completion rate
    const totalSessions = await prisma.candidateSession.count();
    const completedSessions = await prisma.candidateSession.count({
      where: {
        status: "COMPLETED",
      },
    });

    const completionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    const stats = {
      totalInterviews,
      activeInterviews,
      completedToday,
      totalCandidates,
      enrolledCandidates,
      activeSessions: sessionsInProgress,
      totalCohorts,
      activeCohorts,
      totalQuestions,
      sessionsInProgress,
      recentSessions,
      completionRate: Math.round(completionRate * 100) / 100,
      totalSessions,
      completedSessions,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard statistics",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
