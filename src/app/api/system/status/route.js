import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// Use Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("System status API called");

    // Set overall timeout for the entire API call
    const apiTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("API timeout")), 10000)
    );

    const statusCheck = async () => {
      // Check database connection using Prisma with timeout
      let dbStatus = "disconnected";
      let dbError = null;

      try {
        // Test Prisma connection with a simple query and timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Database connection timeout")),
            5000
          )
        );

        const dbPromise = prisma.$queryRaw`SELECT 1`;

        await Promise.race([dbPromise, timeoutPromise]);
        dbStatus = "connected";
        console.log("Database connection successful");
      } catch (error) {
        dbStatus = "error";
        dbError = error.message;
        console.error("Database connection failed:", error);
      }

      // Check system setup status (simplified)
      let setupStatus = "incomplete";
      try {
        // Check if there are any users in the system (indicates setup is complete)
        const userCount = await prisma.user.count();
        if (userCount > 0) {
          setupStatus = "completed";
        }
      } catch (error) {
        console.error("Setup status check failed:", error);
      }

      const systemStatus = {
        status: "online",
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: dbStatus,
            error: dbError,
          },
          setup: {
            status: setupStatus,
          },
          authentication: {
            status: "active",
          },
        },
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };

      console.log("System status:", systemStatus);
      return systemStatus;
    };

    const result = await Promise.race([statusCheck(), apiTimeout]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("System status API error:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Failed to check system status",
      },
      { status: 500 }
    );
  }
}
