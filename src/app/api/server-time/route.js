import { NextResponse } from "next/server";
import { getServerTime } from "../../../lib/timeValidation";

export const runtime = "nodejs";

// GET /api/server-time - Get server time for client synchronization
export async function GET() {
  try {
    const serverTimeData = getServerTime();

    return NextResponse.json({
      success: true,
      ...serverTimeData,
      message: "Server time retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting server time:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get server time",
      },
      { status: 500 }
    );
  }
}
