import { NextResponse } from "next/server";
import { isDatabaseEmpty } from "../../../../lib/config";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("Database check API called");

    const isEmpty = await isDatabaseEmpty();

    console.log("Database empty status:", isEmpty);

    return NextResponse.json({
      isEmpty: isEmpty,
      needsSetup: isEmpty,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database check error:", error);
    return NextResponse.json(
      {
        isEmpty: true,
        needsSetup: true,
        error: "Failed to check database status",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
