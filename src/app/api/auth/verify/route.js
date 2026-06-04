import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { SESSION_IDLE_TIMEOUT_MS } from "../../../../lib/sessionConfig";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function GET(request) {
  try {
    console.log("Session verification API called");

    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "No session token" }, { status: 401 });
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
            organisation: true,
            phone: true,
            role: true,
            isActive: true,
            isActivated: true,
            isSuspended: true,
            isSuperadmin: true,
            profileCompletedAt: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      console.log("Session verification failed: Invalid session");
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (session.user.isSuspended) {
      return NextResponse.json(
        { error: "Account suspended. Please contact admin." },
        { status: 403 }
      );
    }

    // Check if session idle too long (10 min): refresh on each verify, logout after idle
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const timeDiff = now.getTime() - lastActivity.getTime();

    if (timeDiff > SESSION_IDLE_TIMEOUT_MS) {
      // Session idle too long, deactivate it
      await prisma.userSession.update({
        where: { sessionId: sessionToken },
        data: { isActive: false },
      });
      console.log("Session verification failed: Session expired");
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Update last activity
    await prisma.userSession.update({
      where: { sessionId: sessionToken },
      data: { lastActivity: now },
    });

    console.log("Session verified successfully for user:", session.user.email);

    const user = session.user;
    const isExaminer = user.role === "EXAMINER";
    const profileComplete = isExaminer
      ? !!user.profileCompletedAt && !!user.organisation?.trim() && !!user.phone?.trim()
      : true;

    return NextResponse.json({
      success: true,
      user: { ...user, profileComplete },
    });
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json(
      { error: "Session verification failed" },
      { status: 500 }
    );
  }
}
