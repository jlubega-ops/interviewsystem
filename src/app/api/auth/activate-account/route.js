import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

// POST /api/auth/activate-account - Activate account with token
export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one letter and one number" },
        { status: 400 }
      );
    }

    // Find the activation token
    const activationToken = await prisma.accountActivationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!activationToken) {
      return NextResponse.json(
        { error: "Invalid or expired activation token" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (activationToken.expiresAt < new Date()) {
      await prisma.accountActivationToken.delete({
        where: { id: activationToken.id },
      });
      return NextResponse.json(
        { error: "Activation token has expired" },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (activationToken.used) {
      return NextResponse.json(
        { error: "Activation token has already been used" },
        { status: 400 }
      );
    }

    // Hash password
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 12);

    // Activate account and set password
    await prisma.$transaction([
      prisma.user.update({
        where: { id: activationToken.userId },
        data: {
          passwordHash: hashedPassword,
          isActivated: true,
        },
      }),
      prisma.accountActivationToken.update({
        where: { id: activationToken.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Account has been activated successfully",
    });
  } catch (error) {
    console.error("Error activating account:", error);
    return NextResponse.json(
      {
        error: "Failed to activate account",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET /api/auth/activate-account - Verify activation token
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Activation token is required" },
        { status: 400 }
      );
    }

    // Find the activation token
    const activationToken = await prisma.accountActivationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!activationToken) {
      return NextResponse.json(
        { error: "Invalid activation token" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (activationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Activation token has expired" },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (activationToken.used) {
      return NextResponse.json(
        { error: "Activation token has already been used" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Activation token is valid",
      user: {
        email: activationToken.user.email,
        fullName: activationToken.user.fullName,
      },
    });
  } catch (error) {
    console.error("Error verifying activation token:", error);
    return NextResponse.json(
      {
        error: "Failed to verify activation token",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
