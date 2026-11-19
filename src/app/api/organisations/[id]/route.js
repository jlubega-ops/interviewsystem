import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/apiAuth";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

export const runtime = "nodejs";

const CONFIRM_WORD = "DELETE";

export async function PUT(request, { params }) {
  try {
    const auth = await requireApiUser(request, { roles: ["SUPERADMIN"] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;

    const existing = await prisma.organisation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Organisation name is required" },
        { status: 400 }
      );
    }

    const clash = await prisma.organisation.findFirst({
      where: { name, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: "An organisation with this name already exists" },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.update({
        where: { id },
        data: {
          name,
          description: description || null,
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      if (existing.name !== name) {
        await tx.user.updateMany({
          where: { organisation: existing.name },
          data: { organisation: name },
        });
        await tx.cohort.updateMany({
          where: { organisation: existing.name },
          data: { organisation: name },
        });
      }

      return org;
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
      actionType: ACTION_TYPES.EDIT_ORGANISATION,
      resource: "organisation",
      description: `Updated organisation "${updated.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating organisation:", error);
    return NextResponse.json(
      { error: "Failed to update organisation", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireApiUser(request, { roles: ["SUPERADMIN"] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const confirmWord =
      typeof body.confirmWord === "string" ? body.confirmWord.trim() : "";

    if (confirmWord !== CONFIRM_WORD) {
      return NextResponse.json(
        { error: `Type ${CONFIRM_WORD} to confirm deletion.` },
        { status: 400 }
      );
    }

    const existing = await prisma.organisation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    const [userCount, cohortCount] = await Promise.all([
      prisma.user.count({ where: { organisation: existing.name } }),
      prisma.cohort.count({ where: { organisation: existing.name } }),
    ]);
    if (userCount > 0 || cohortCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${existing.name}" because it is still used by ${userCount} user(s) and ${cohortCount} cohort(s). Reassign them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.organisation.delete({ where: { id } });

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
      actionType: ACTION_TYPES.DELETE_ORGANISATION,
      resource: "organisation",
      description: `Deleted organisation "${existing.name}"`,
      ...getRequestMeta(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organisation:", error);
    return NextResponse.json(
      { error: "Failed to delete organisation", details: error.message },
      { status: 500 }
    );
  }
}
