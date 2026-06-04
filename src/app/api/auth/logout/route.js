import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createLog, getRequestMeta, ACTION_TYPES } from "../../../../lib/activityLog.js";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const sessionToken = request.cookies.get("session_token")?.value;
    const meta = getRequestMeta(request);

    if (sessionToken) {
      try {
        const session = await prisma.userSession.findUnique({
          where: { sessionId: sessionToken },
          include: { user: { select: { id: true, fullName: true, email: true, organisation: true, role: true } } },
        });
        if (session?.user) {
          await createLog({
            actorType: "USER",
            userId: session.user.id,
            actorName: session.user.fullName,
            actorEmail: session.user.email,
            actorOrg: session.user.organisation ?? null,
            actorRole: session.user.role,
            actionType: ACTION_TYPES.LOGOUT,
            resource: "auth",
            description: `User ${session.user.fullName} (${session.user.email}) logged out`,
            ...meta,
          });
        }
      } catch (e) {
        console.error("Error logging logout:", e);
      }
      try {
        await prisma.userSession.updateMany({
          where: { sessionId: sessionToken },
          data: { isActive: false },
        });
      } catch (error) {
        console.error("Error deactivating session:", error);
      }
    }

    // Clear cookies
    const response = NextResponse.json({
      success: true,
      message: "Logout successful",
    });

    // Clear session_token cookie (the one actually used by the system)
    response.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    // Also clear any legacy cookies that might exist
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    response.cookies.set("session-id", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
