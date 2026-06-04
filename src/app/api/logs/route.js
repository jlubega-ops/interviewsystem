import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN"];

// GET /api/logs - List activity logs (Admin only). Supports filters and search.
export async function GET(request) {
  try {
    const userRole = request.headers.get("x-user-role");
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required to view logs." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); // ISO date
    const to = searchParams.get("to"); // ISO date
    const actionType = searchParams.get("actionType");
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where = {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (search) {
      where.OR = [
        { actorName: { contains: search } },
        { actorEmail: { contains: search } },
        { actorOrg: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs", details: error.message },
      { status: 500 }
    );
  }
}
