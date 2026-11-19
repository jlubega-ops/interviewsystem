import { NextResponse } from "next/server";
import { verifySession } from "../middleware/auth";

/**
 * Authenticate staff API requests from the session cookie only.
 * Do not trust client-supplied x-user-* headers.
 */
export async function requireApiUser(request, { roles } = {}) {
  const { isValid, user, error } = await verifySession(request);

  if (!isValid || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized", message: error || "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Forbidden", message: "Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}
