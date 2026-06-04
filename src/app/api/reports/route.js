import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../lib/activityLog.js";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

/**
 * GET /api/reports?report=completion|performance|cohorts|submissions
 * &cohortId= &interviewType= &from= &to= &organisation=
 * Admin only.
 */
export async function GET(request) {
  try {
    const userRole = request.headers.get("x-user-role");
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, organisation: true } }) : null;
    await createLog({
      actorType: "USER",
      userId,
      actorName: actor?.fullName ?? null,
      actorEmail: userEmail ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: userRole,
      actionType: ACTION_TYPES.VIEW_REPORTS,
      resource: "reports",
      description: "Viewed reports",
      ...getRequestMeta(request),
    });

    const { searchParams } = new URL(request.url);
    const report = searchParams.get("report") || "completion";
    const cohortId = searchParams.get("cohortId") || null;
    const interviewType = searchParams.get("interviewType") || null;
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;
    const organisation = searchParams.get("organisation") || null;

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    if (report === "completion") {
      return NextResponse.json({
        success: true,
        data: await getCompletionReport({ cohortId, interviewType, fromDate, toDate, organisation }),
      });
    }
    if (report === "performance") {
      return NextResponse.json({
        success: true,
        data: await getPerformanceReport({ cohortId, interviewType, fromDate, toDate, organisation }),
      });
    }
    if (report === "cohorts") {
      return NextResponse.json({
        success: true,
        data: await getCohortSummaryReport({ fromDate, toDate, organisation }),
      });
    }
    if (report === "submissions") {
      return NextResponse.json({
        success: true,
        data: await getSubmissionOutcomesReport({ cohortId, interviewType, fromDate, toDate, organisation }),
      });
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json(
      { error: "Failed to load report", details: error.message },
      { status: 500 }
    );
  }
}

function buildSessionWhere({ cohortId, interviewType, fromDate, toDate }) {
  const where = {};
  if (fromDate || toDate) {
    where.startedAt = {};
    if (fromDate) where.startedAt.gte = fromDate;
    if (toDate) where.startedAt.lte = toDate;
  }
  if (cohortId || interviewType) {
    where.interview = {};
    if (interviewType) where.interview.type = interviewType;
    if (cohortId) {
      where.interview.cohortInterviews = { some: { cohortId } };
    }
  }
  return where;
}

async function getCompletionReport({ cohortId, interviewType, fromDate, toDate, organisation }) {
  const where = buildSessionWhere({ cohortId, interviewType, fromDate, toDate });
  const sessions = await prisma.candidateSession.findMany({
    where,
    select: {
      id: true,
      status: true,
      submissionReason: true,
      startedAt: true,
      completedAt: true,
      interviewId: true,
      interview: {
        select: {
          type: true,
          cohortInterviews: {
            select: {
              cohortId: true,
              cohort: { select: { name: true, organisation: true } },
            },
          },
        },
      },
    },
  });

  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "COMPLETED").length;
  const inProgress = sessions.filter((s) => s.status === "IN_PROGRESS").length;
  const abandoned = sessions.filter((s) => s.status === "STARTED" && !s.completedAt).length;
  const started = total;
  const completionRate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;

  const bySubmissionReason = {};
  sessions.forEach((s) => {
    if (s.status === "COMPLETED" && s.submissionReason) {
      const r = (s.submissionReason || "").trim().toUpperCase();
      bySubmissionReason[r] = (bySubmissionReason[r] || 0) + 1;
    }
  });

  const byInterviewType = {};
  sessions.forEach((s) => {
    const t = s.interview?.type || "UNKNOWN";
    byInterviewType[t] = (byInterviewType[t] || 0) + 1;
  });

  const cohortList = await getCohortListForFilter(organisation);
  return {
    summary: { total, completed, inProgress, abandoned, started, completionRate },
    bySubmissionReason: Object.entries(bySubmissionReason).map(([reason, count]) => ({ reason, count })),
    byInterviewType: Object.entries(byInterviewType).map(([type, count]) => ({ type, count })),
    filters: { cohortId, interviewType, from: fromDate?.toISOString?.(), to: toDate?.toISOString?.(), organisation },
    cohortOptions: cohortList,
  };
}

async function getPerformanceReport({ cohortId, interviewType, fromDate, toDate, organisation }) {
  const where = buildSessionWhere({ cohortId, interviewType, fromDate, toDate });
  where.status = "COMPLETED";
  const sessions = await prisma.candidateSession.findMany({
    where,
    select: {
      id: true,
      score: true,
      totalQuestions: true,
      candidateName: true,
      candidateEmail: true,
      accessKey: true,
      completedAt: true,
      submissionReason: true,
      interview: {
        select: {
          type: true,
          cohortInterviews: {
            select: { cohort: { select: { name: true } } },
          },
        },
      },
    },
  });

  const withScore = sessions.filter((s) => s.totalQuestions > 0);
  const totalPoints = withScore.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
  const totalEarned = withScore.reduce((sum, s) => sum + (s.score || 0), 0);
  const avgScore = withScore.length > 0 ? Math.round((totalEarned / withScore.length) * 100) / 100 : 0;
  const avgPercent = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 10000) / 100 : 0;
  const minScore = withScore.length ? Math.min(...withScore.map((s) => s.score)) : 0;
  const maxScore = withScore.length ? Math.max(...withScore.map((s) => s.score)) : 0;

  const byInterviewType = {};
  withScore.forEach((s) => {
    const t = s.interview?.type || "UNKNOWN";
    if (!byInterviewType[t]) byInterviewType[t] = { sum: 0, count: 0, totalPoints: 0 };
    byInterviewType[t].sum += s.score || 0;
    byInterviewType[t].count += 1;
    byInterviewType[t].totalPoints += s.totalQuestions || 0;
  });

  const cohortList = await getCohortListForFilter(organisation);
  return {
    summary: {
      attemptCount: withScore.length,
      avgScore,
      avgPercent,
      minScore,
      maxScore,
      totalPoints,
      totalEarned,
    },
    byInterviewType: Object.entries(byInterviewType).map(([type, v]) => ({
      type,
      avgScore: v.count ? Math.round((v.sum / v.count) * 100) / 100 : 0,
      avgPercent: v.totalPoints ? Math.round((v.sum / v.totalPoints) * 10000) / 100 : 0,
      count: v.count,
    })),
    topCandidates: withScore
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20)
      .map((s) => ({
        candidateName: s.candidateName,
        candidateEmail: s.candidateEmail,
        score: s.score,
        totalQuestions: s.totalQuestions,
        percent: s.totalQuestions ? Math.round((s.score / s.totalQuestions) * 10000) / 100 : 0,
        interviewType: s.interview?.type,
        cohortName: s.interview?.cohortInterviews?.[0]?.cohort?.name,
      })),
    filters: { cohortId, interviewType, from: fromDate?.toISOString?.(), to: toDate?.toISOString?.(), organisation },
    cohortOptions: cohortList,
  };
}

async function getCohortSummaryReport({ fromDate, toDate, organisation }) {
  const where = {};
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }
  if (organisation) where.organisation = { contains: organisation };

  const cohorts = await prisma.cohort.findMany({
    where,
    include: {
      _count: { select: { enrollments: true } },
      creator: { select: { fullName: true, email: true } },
      interviews: {
        include: { interview: { select: { id: true, type: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sessionCounts = await Promise.all(
    cohorts.map(async (c) => {
      const interviewIds = c.interviews.map((i) => i.interviewId);
      const [total, completed] = await Promise.all([
        prisma.candidateSession.count({ where: { interviewId: { in: interviewIds } } }),
        prisma.candidateSession.count({ where: { interviewId: { in: interviewIds }, status: "COMPLETED" } }),
      ]);
      return { total, completed, rate: total ? Math.round((completed / total) * 10000) / 100 : 0 };
    })
  );

  const rows = cohorts.map((c, i) => ({
    id: c.id,
    name: c.name,
    organisation: c.organisation,
    openTime: c.openTime,
    closeTime: c.closeTime,
    isActive: c.isActive,
    enrollmentCount: c._count.enrollments,
    creatorName: c.creator?.fullName,
    attemptsTotal: sessionCounts[i]?.total ?? 0,
    attemptsCompleted: sessionCounts[i]?.completed ?? 0,
    completionRate: sessionCounts[i]?.rate ?? 0,
    interviewTypes: [...new Set(c.interviews.map((ci) => ci.interview?.type))].filter(Boolean),
  }));

  const orgList = await prisma.cohort.findMany({ where: { organisation: { not: null } }, select: { organisation: true }, distinct: ["organisation"] });
  return {
    rows,
    organisationOptions: orgList.map((o) => o.organisation).filter(Boolean).sort(),
    filters: { from: fromDate?.toISOString?.(), to: toDate?.toISOString?.(), organisation },
  };
}

async function getSubmissionOutcomesReport({ cohortId, interviewType, fromDate, toDate, organisation }) {
  const where = buildSessionWhere({ cohortId, interviewType, fromDate, toDate });
  where.status = "COMPLETED";
  const sessions = await prisma.candidateSession.findMany({
    where,
    select: { submissionReason: true, interview: { select: { type: true } } },
  });

  const byReason = {};
  sessions.forEach((s) => {
    const r = (s.submissionReason || "UNKNOWN").trim().toUpperCase();
    byReason[r] = (byReason[r] || 0) + 1;
  });

  const byReasonAndType = {};
  sessions.forEach((s) => {
    const r = (s.submissionReason || "UNKNOWN").trim().toUpperCase();
    const t = s.interview?.type || "UNKNOWN";
    const key = `${r}|${t}`;
    byReasonAndType[key] = (byReasonAndType[key] || 0) + 1;
  });

  const cohortList = await getCohortListForFilter(organisation);
  return {
    byReason: Object.entries(byReason).map(([reason, count]) => ({ reason, count })),
    byReasonAndType: Object.entries(byReasonAndType).map(([key, count]) => {
      const [reason, type] = key.split("|");
      return { reason, type, count };
    }),
    totalCompleted: sessions.length,
    filters: { cohortId, interviewType, from: fromDate?.toISOString?.(), to: toDate?.toISOString?.(), organisation },
    cohortOptions: cohortList,
  };
}

async function getCohortListForFilter(organisation) {
  const where = {};
  if (organisation) where.organisation = { contains: organisation };
  const list = await prisma.cohort.findMany({
    where,
    select: { id: true, name: true, organisation: true, openTime: true, closeTime: true },
    orderBy: { createdAt: "desc" },
  });
  return list;
}
