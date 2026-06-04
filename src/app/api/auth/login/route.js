import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma";
import { config } from "../../../../lib/config";
import { logger } from "../../../../lib/logger.js";
import { addNoCacheHeaders } from "../../../../lib/cache-control.js";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function POST(request) {
  try {
    logger.auth("🔐 Login API called");
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      logger.auth("❌ Login failed: Missing credentials", {
        email: !!email,
        password: !!password,
      });
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Get client information
    const userAgent = request.headers.get("user-agent") || "Unknown";
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const meta = getRequestMeta(request);

    logger.auth("🔍 Login attempt", {
      email,
      ipAddress,
      userAgent: userAgent.substring(0, 50),
    });

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        role: true,
        isSuperadmin: true,
        isActive: true,
        isActivated: true,
        isSuspended: true,
      },
    });

    if (!user) {
      logger.auth("❌ Login failed: User not found", { email, ipAddress });
      await createLog({
        actorType: "USER",
        actorEmail: email,
        actorName: null,
        actorRole: null,
        actionType: ACTION_TYPES.LOGIN_FAILED,
        resource: "auth",
        description: `Login failed: user not found for email ${email}`,
        ...meta,
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Block suspended users
    if (user.isSuspended) {
      logger.auth("❌ Login failed: Account suspended", {
        email,
        ipAddress,
        userId: user.id,
      });
      await createLog({
        actorType: "USER",
        userId: user.id,
        actorName: user.fullName,
        actorEmail: user.email,
        actorRole: user.role,
        actionType: ACTION_TYPES.LOGIN_SUSPENDED,
        resource: "auth",
        description: `Login blocked: account suspended for ${user.email}`,
        ...meta,
      });
      return NextResponse.json(
        { error: "Your account is suspended. Please contact admin." },
        { status: 403 }
      );
    }

    // Block inactive (not yet activated) users
    if (!user.isActivated) {
      logger.auth("❌ Login failed: Account not activated", {
        email,
        ipAddress,
        userId: user.id,
      });
      await createLog({
        actorType: "USER",
        userId: user.id,
        actorName: user.fullName,
        actorEmail: user.email,
        actorRole: user.role,
        actionType: ACTION_TYPES.LOGIN_NOT_ACTIVATED,
        resource: "auth",
        description: `Login blocked: account not activated for ${user.email}`,
        ...meta,
      });
      return NextResponse.json(
        { error: "Please activate your account using the link sent to your email before logging in." },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      logger.auth("❌ Login failed: User inactive", { email, ipAddress });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Reject if no password set (e.g. user created but not yet activated)
    const hash = user.passwordHash;
    if (!hash || typeof hash !== "string" || !hash.startsWith("$2")) {
      logger.auth("❌ Login failed: Account not activated (no password set)", {
        email,
        ipAddress,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Please activate your account using the link sent to your email before logging in." },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, hash);
    if (!isValidPassword) {
      logger.auth("❌ Login failed: Invalid password", {
        email,
        ipAddress,
        userId: user.id,
      });
      await createLog({
        actorType: "USER",
        userId: user.id,
        actorName: user.fullName,
        actorEmail: user.email,
        actorRole: user.role,
        actionType: ACTION_TYPES.LOGIN_FAILED,
        resource: "auth",
        description: `Login failed: invalid password for ${user.email}`,
        ...meta,
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Remove any existing sessions for this user (single device login)
    await prisma.userSession.deleteMany({
      where: { userId: user.id },
    });

    // Generate session ID
    const sessionId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36);

    await prisma.$transaction([
      prisma.userSession.create({
        data: {
          userId: user.id,
          sessionId: sessionId,
          userAgent: userAgent,
          ipAddress: ipAddress,
          isActive: true,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.auth("✅ Login successful", {
      email,
      userId: user.id,
      role: user.role,
      isSuperadmin: user.isSuperadmin,
      ipAddress,
      sessionId,
    });
    const creator = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organisation: true },
    });
    await createLog({
      actorType: "USER",
      userId: user.id,
      actorName: user.fullName,
      actorEmail: user.email,
      actorOrg: creator?.organisation ?? null,
      actorRole: user.role,
      actionType: ACTION_TYPES.LOGIN_SUCCESS,
      resource: "auth",
      description: `User ${user.fullName} (${user.email}) logged in successfully`,
      ...meta,
    });

    // Set HTTP-only cookie for security
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isSuperadmin: user.isSuperadmin,
      },
      message: "Login successful",
    });

    // Add no-cache headers to prevent stale data
    addNoCacheHeaders(response);

    // Set secure HTTP-only cookie
    response.cookies.set("session_token", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    logger.error("❌ Login API error", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
