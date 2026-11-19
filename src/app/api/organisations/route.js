import { NextResponse } from "next/server";
import { requireApiUser } from "../../../lib/apiAuth";
import { prisma } from "../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../lib/activityLog.js";

export const runtime = "nodejs";

const READ_ROLES = ["SUPERADMIN", "ADMIN", "EXAMINER"];

export async function GET(request) {
  try {
    const auth = await requireApiUser(request, { roles: READ_ROLES });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "1";

    const organisations = await prisma.organisation.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: "asc" },
    });

    const names = organisations.map((o) => o.name);
    const [userGroups, cohortGroups] = await Promise.all([
      names.length
        ? prisma.user.groupBy({
            by: ["organisation"],
            where: { organisation: { in: names } },
            _count: { _all: true },
          })
        : [],
      names.length
        ? prisma.cohort.groupBy({
            by: ["organisation"],
            where: { organisation: { in: names } },
            _count: { _all: true },
          })
        : [],
    ]);

    const userCount = Object.fromEntries(
      userGroups.map((g) => [g.organisation, g._count._all])
    );
    const cohortCount = Object.fromEntries(
      cohortGroups.map((g) => [g.organisation, g._count._all])
    );

    return NextResponse.json({
      success: true,
      data: organisations.map((org) => ({
        ...org,
        userCount: userCount[org.name] || 0,
        cohortCount: cohortCount[org.name] || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching organisations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organisations", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireApiUser(request, { roles: ["SUPERADMIN"] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Organisation name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.organisation.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An organisation with this name already exists" },
        { status: 409 }
      );
    }

    const org = await prisma.organisation.create({
      data: {
        name,
        description: description || null,
        createdBy: auth.user.id,
      },
    });

    const actor = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { fullName: true, organisation: true },
    });
    await createLog({
      actorType: "USER",
      userId: auth.user.id,
      actorName: actor?.fullName ?? null,
      actorEmail: auth.user.email ?? null,
      actorOrg: actor?.organisation ?? null,
      actorRole: auth.user.role,
      actionType: ACTION_TYPES.CREATE_ORGANISATION,
      resource: "organisation",
      description: `Created organisation "${org.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({ success: true, data: org }, { status: 201 });
  } catch (error) {
    console.error("Error creating organisation:", error);
    return NextResponse.json(
      { error: "Failed to create organisation", details: error.message },
      { status: 500 }
    );
  }
}
