// Database configuration using DATABASE_URL (Prisma standard)
export const config = {
  // Database configuration - using DATABASE_URL for consistency with Prisma
  database: {
    url:
      process.env.DATABASE_URL ||
      "mysql://root:password@localhost:3306/interview_system",
  },

  // JWT configuration
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET environment variable is required");
      }
      if (secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters long");
      }
      if (
        secret === "change-this-to-a-very-secure-random-string-in-production"
      ) {
        throw new Error("JWT_SECRET must be changed from default value");
      }
      return secret;
    })(),
    expiresIn: "24h",
  },

  // System configuration
  system: {
    name: "Interview Portal",
    version: "1.0.0",
    setupCompleted: false, // This will be updated after setup
  },
};

// Check if database is empty using Prisma
export const isDatabaseEmpty = async () => {
  try {
    const { prisma } = await import("./prisma");

    // Check if users table has any records
    const userCount = await prisma.user.count();

    return userCount === 0;
  } catch (error) {
    console.error("Error checking if database is empty:", error);
    // If Prisma fails, assume database has data (not empty)
    return false;
  }
};
