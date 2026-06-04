// Authentication middleware for protecting routes
import { NextResponse } from "next/server";
import { prisma } from "../lib/prisma";
import { SESSION_IDLE_TIMEOUT_MS } from "../lib/sessionConfig";

export async function verifySession(request) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return { isValid: false, user: null, error: "No session token" };
    }

    const session = await prisma.userSession.findUnique({
      where: { sessionId: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isSuspended: true,
            isSuperadmin: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return { isValid: false, user: null, error: "Invalid session" };
    }

    if (session.user.isSuspended) {
      return { isValid: false, user: null, error: "Account suspended" };
    }

    // Check if session is idle too long (10 min): refresh on each request, logout after idle
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();

    if (timeDiff > SESSION_IDLE_TIMEOUT_MS) {
      // Session idle too long, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      return { isValid: false, user: null, error: "Session expired" };
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    return { isValid: true, user: session.user, error: null };
  } catch (error) {
    console.error("Session verification error:", error);
    return { isValid: false, user: null, error: "Session verification failed" };
  }
}

export function requireAuth(roles = []) {
  return async function middleware(request) {
    const { isValid, user, error } = await verifySession(request);

    if (!isValid) {
      // Redirect to login if not authenticated
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check role permissions if specified
    if (roles.length > 0 && !roles.includes(user.role)) {
      // Redirect to unauthorized page or dashboard
      const dashboardUrl = new URL("/admin/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Add user info to headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id.toString());
    requestHeaders.set("x-user-role", user.role);
    requestHeaders.set("x-user-email", user.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };
}

export function requireRole(role) {
  return requireAuth([role]);
}

export function requireAnyRole(roles) {
  return requireAuth(roles);
}
