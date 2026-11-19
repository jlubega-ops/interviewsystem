import { NextResponse } from "next/server";
import { verifySession } from "./middleware/auth";
import { logger } from "./lib/logger.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const safeHeaders = new Headers(request.headers);
  safeHeaders.delete("x-user-id");
  safeHeaders.delete("x-user-role");
  safeHeaders.delete("x-user-email");

  // Logged-in users should never see the login page
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    const { isValid } = await verifySession(request);
    if (isValid) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next({ request: { headers: safeHeaders } });
  }

  // Define protected routes with their required roles (Admin can perform all actions)
  const protectedRoutes = {
    "/admin/dashboard": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/admin/cohorts": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/admin/interviews": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/admin/question-banks": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/admin/users": ["SUPERADMIN", "ADMIN"],
    "/admin/organisations": ["SUPERADMIN"],
    "/admin/logs": ["SUPERADMIN", "ADMIN"],
    "/admin/reports": ["SUPERADMIN", "ADMIN"],
    "/admin/profile": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/admin/settings": ["SUPERADMIN", "ADMIN"],
  };

  // Define API routes that need authentication
  const protectedApiRoutes = {
    "/api/auth/verify": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/auth/profile": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/auth/change-password": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/cohorts": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/interviews": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/users": ["SUPERADMIN", "ADMIN"],
    "/api/logs": ["SUPERADMIN", "ADMIN"],
    "/api/candidates": ["SUPERADMIN", "ADMIN"],
    "/api/reports": ["SUPERADMIN", "ADMIN"],
    "/api/dashboard": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/system": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/question-banks": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
    "/api/organisations": ["SUPERADMIN", "ADMIN", "EXAMINER", "FACILITATOR"],
  };

  // Define public API routes (no authentication required)
  const publicApiRoutes = [
    "/api/server-time",
    "/api/system/status",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/activate-account",
    "/api/auth/reset-password",
    "/api/auth/forgot-password",
    "/api/candidate/verify-access",
    "/api/candidate/verify-session",
    "/api/candidate/verify-interview-access",
    "/api/candidate/start-attempt",
    "/api/candidate/resume-attempt",
    "/api/candidate/check-attempts",
    "/api/candidate/attempt-results",
    "/api/candidate/check-time",
    "/api/candidate/get-answers",
    "/api/candidate/save-answer",
    "/api/candidate/leave-attempt",
    "/api/candidate/submit-attempt",
    "/api/candidate/logout",
  ];

  // Check if the current path is a protected route
  const isProtectedRoute = Object.keys(protectedRoutes).some((route) =>
    pathname.startsWith(route)
  );

  const isProtectedApiRoute = Object.keys(protectedApiRoutes).some((route) =>
    pathname.startsWith(route)
  );

  // Check if it's a public API route
  const isPublicApiRoute = publicApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If it's a protected route or protected API, check for authentication
  if (isProtectedRoute || (isProtectedApiRoute && !isPublicApiRoute)) {
    const { isValid, user, error } = await verifySession(request);

    if (!isValid) {
      logger.auth("❌ Authentication failed", {
        pathname,
        error,
        userAgent: request.headers.get("user-agent")?.substring(0, 50),
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "127.0.0.1",
      });

      // For API routes, return 401
      if (isProtectedApiRoute && !isPublicApiRoute) {
        const response = NextResponse.json(
          { error: "Unauthorized", message: error },
          { status: 401 }
        );
        
        // Clear session_token cookie if it exists
        const sessionToken = request.cookies.get("session_token")?.value;
        if (sessionToken) {
          response.cookies.set("session_token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 0,
            path: "/",
          });
        }
        
        return response;
      }

      // For page routes, redirect to login
      const loginUrl = new URL("/admin/login", request.url);
      
      // Add expired session parameters if session expired or invalid
      if (error === "Session expired" || error === "Invalid session" || error === "No session token") {
        loginUrl.searchParams.set("expired", "true");
        loginUrl.searchParams.set("error", error);
      }
      
      const response = NextResponse.redirect(loginUrl);
      
      // Clear session_token cookie if it exists
      const sessionToken = request.cookies.get("session_token")?.value;
      if (sessionToken) {
        response.cookies.set("session_token", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });
      }
      
      return response;
    }

    // Check role permissions
    let requiredRoles = [];
    if (isProtectedRoute) {
      const route = Object.keys(protectedRoutes).find((route) =>
        pathname.startsWith(route)
      );
      requiredRoles = protectedRoutes[route] || [];
    } else if (isProtectedApiRoute && !isPublicApiRoute) {
      const route = Object.keys(protectedApiRoutes).find((route) =>
        pathname.startsWith(route)
      );
      requiredRoles = protectedApiRoutes[route] || [];
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      logger.auth("🚫 Access denied: Insufficient permissions", {
        pathname,
        userRole: user.role,
        requiredRoles,
        userId: user.id,
        email: user.email,
      });

      // For API routes, return 403
      if (isProtectedApiRoute && !isPublicApiRoute) {
        return NextResponse.json(
          { error: "Forbidden", message: "Insufficient permissions" },
          { status: 403 }
        );
      }

      // For page routes, redirect to dashboard
      const dashboardUrl = new URL("/admin/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Add user info to headers for API routes (never trust client-supplied values)
    safeHeaders.set("x-user-id", user.id.toString());
    safeHeaders.set("x-user-role", user.role);
    safeHeaders.set("x-user-email", user.email);

    // Debug logging for dashboard stats
    if (pathname.includes("dashboard")) {
      console.log("Dashboard API request - User:", {
        id: user.id,
        role: user.role,
        email: user.email,
      });
    }

    // Log successful access (only for API routes to avoid spam)
    if (isProtectedApiRoute && !isPublicApiRoute) {
      logger.auth("✅ Access granted", {
        pathname,
        userRole: user.role,
        userId: user.id,
        email: user.email,
      });
    }

    const response = NextResponse.next({
      request: {
        headers: safeHeaders,
      },
    });

    // Add cache control headers to prevent stale data
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }

  return NextResponse.next({
    request: {
      headers: safeHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/auth/:path*",
    "/api/cohorts/:path*",
    "/api/interviews/:path*",
    "/api/users/:path*",
    "/api/logs/:path*",
    "/api/candidates/:path*",
    "/api/reports/:path*",
    "/api/dashboard/:path*",
    "/api/system/:path*",
    "/api/question-banks/:path*",
    "/api/organisations/:path*",
  ],
};
