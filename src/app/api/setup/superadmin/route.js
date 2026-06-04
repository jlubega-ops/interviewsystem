import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function POST(request) {
  try {
    console.log("Super admin creation API called");
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    console.log("Creating super admin for:", email);

    // Check if super admin already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: "SUPERADMIN" },
    });

    if (existingSuperAdmin) {
      return NextResponse.json(
        { error: "Super admin already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create super admin
    const superAdmin = await prisma.user.create({
      data: {
        email: email,
        username: email.split("@")[0],
        passwordHash: hashedPassword,
        fullName: fullName,
        role: "SUPERADMIN",
        isSuperadmin: true,
        cannotBeDeleted: true,
        isActive: true,
      },
    });

    console.log("Super admin created successfully");

    return NextResponse.json({
      success: true,
      message: "Super admin account created successfully",
      data: {
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        created: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Super admin creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create super admin account",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
