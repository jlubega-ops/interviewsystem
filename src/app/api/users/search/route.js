import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

function isAdmin(role) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

// GET /api/users/search?q=...&cohortId=... - Search users (EXAMINER role) by email or name; optionally mark already assigned to cohort
export async function GET(request) {
  try {
    const userRole = request.headers.get("x-user-role");
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const cohortId = searchParams.get("cohortId") || null;
    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "Enter at least 2 characters to search",
      });
    }
    const users = await prisma.user.findMany({
      where: {
        role: "EXAMINER",
        OR: [
          { email: { contains: q } },
          { fullName: { contains: q } },
          { firstName: { contains: q } },
          { lastName: { contains: q } },
        ],
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        organisation: true,
        phone: true,
        role: true,
        isActivated: true,
        isSuspended: true,
      },
      take: 20,
    });
    let assignedUserIds = [];
    if (cohortId) {
      const assignments = await prisma.cohortExaminer.findMany({
        where: { cohortId },
        select: { userId: true },
      });
      assignedUserIds = assignments.map((a) => a.userId);
    }
    const data = users.map((u) => ({
      ...u,
      alreadyAssignedToThisCohort: assignedUserIds.includes(u.id),
    }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Error searching users:", e);
    return NextResponse.json(
      { error: "Failed to search users", details: e.message },
      { status: 500 }
    );
  }
}
