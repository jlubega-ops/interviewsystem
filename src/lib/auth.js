// Authentication utilities for the interview system
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { config } from "./config";
import { logger } from "./logger";

// JWT secret from config
const JWT_SECRET = config.jwt.secret;
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

export const authUtils = {
  // Generate a unique session ID
  generateSessionId: () => {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36)
    );
  },

  // Generate JWT token with session info
  generateToken: (user, sessionId) => {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId,
        loginTime: Date.now(),
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  },

  // Verify JWT token
  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  },

  // Hash password
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  },

  // Compare password
  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  // Check if session is still valid
  isSessionValid: (loginTime) => {
    const now = Date.now();
    return now - loginTime < SESSION_TIMEOUT;
  },
};

// Session management
export const sessionManager = {
  // Active sessions storage (in production, use Redis or database)
  activeSessions: new Map(),

  // Create new session (optimized)
  createSession: async (userId, sessionId, userAgent, ipAddress, userData) => {
    const session = {
      userId,
      sessionId,
      userAgent,
      ipAddress,
      loginTime: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      // Store user data in session to avoid database queries
      email: userData.email,
      fullName: userData.fullName,
      role: userData.role,
    };

    // Remove any existing sessions for this user
    await sessionManager.logoutUserFromAllDevices(userId);

    // Store new session
    sessionManager.activeSessions.set(sessionId, session);

    // Also store in database
    await sessionManager.storeSessionInDB(session);

    return session;
  },

  // Get session by ID
  getSession: (sessionId) => {
    return sessionManager.activeSessions.get(sessionId);
  },

  // Update session activity
  updateActivity: (sessionId) => {
    const session = sessionManager.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      sessionManager.activeSessions.set(sessionId, session);
    }
  },

  // Logout user from all devices
  logoutUserFromAllDevices: async (userId) => {
    // Remove from memory
    for (const [
      sessionId,
      session,
    ] of sessionManager.activeSessions.entries()) {
      if (session.userId === userId) {
        sessionManager.activeSessions.delete(sessionId);
      }
    }

    // Remove from database
    await sessionManager.removeUserSessionsFromDB(userId);
  },

  // Logout specific session
  logoutSession: async (sessionId) => {
    const session = sessionManager.activeSessions.get(sessionId);
    if (session) {
      sessionManager.activeSessions.delete(sessionId);
      await sessionManager.removeSessionFromDB(sessionId);
    }
  },

  // Check if user has active session elsewhere
  hasActiveSessionElsewhere: (userId, currentSessionId) => {
    for (const [
      sessionId,
      session,
    ] of sessionManager.activeSessions.entries()) {
      if (session.userId === userId && sessionId !== currentSessionId) {
        return true;
      }
    }
    return false;
  },

  // Clean up expired sessions
  cleanupExpiredSessions: () => {
    const now = Date.now();
    for (const [
      sessionId,
      session,
    ] of sessionManager.activeSessions.entries()) {
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        sessionManager.activeSessions.delete(sessionId);
        sessionManager.removeSessionFromDB(sessionId);
      }
    }
  },

  // Store session in database
  storeSessionInDB: async (session) => {
    try {
      await prisma.userSession.upsert({
        where: { sessionId: session.sessionId },
        update: {
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          loginTime: new Date(session.loginTime),
          lastActivity: new Date(session.lastActivity),
          isActive: session.isActive,
        },
        create: {
          userId: session.userId,
          sessionId: session.sessionId,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          loginTime: new Date(session.loginTime),
          lastActivity: new Date(session.lastActivity),
          isActive: session.isActive,
        },
      });
    } catch (error) {
      console.error("Error storing session in DB:", error);
    }
  },

  // Remove session from database
  removeSessionFromDB: async (sessionId) => {
    try {
      await prisma.userSession.delete({
        where: { sessionId: sessionId },
      });
    } catch (error) {
      console.error("Error removing session from DB:", error);
    }
  },

  // Remove all user sessions from database
  removeUserSessionsFromDB: async (userId) => {
    try {
      await prisma.userSession.deleteMany({
        where: { userId: userId },
      });
    } catch (error) {
      console.error("Error removing user sessions from DB:", error);
    }
  },
};

// User authentication using Prisma
export const authenticateUser = async (
  email,
  password,
  userAgent,
  ipAddress
) => {
  try {
    logger.auth("Authenticating user", {
      email: email.substring(0, 3) + "***",
    });

    // Get user by email using Prisma
    const user = await prisma.user.findUnique({
      where: {
        email: email,
        isActive: true,
      },
    });

    if (!user) {
      logger.auth("User not found", { email: email.substring(0, 3) + "***" });
      return { success: false, error: "Invalid credentials" };
    }

    logger.auth("User found", { role: user.role });

    // Verify password
    const isValidPassword = await authUtils.comparePassword(
      password,
      user.passwordHash
    );
    if (!isValidPassword) {
      logger.auth("Invalid password", { email: email.substring(0, 3) + "***" });
      return { success: false, error: "Invalid credentials" };
    }

    // Check if user has active session elsewhere
    const hasActiveSession = sessionManager.hasActiveSessionElsewhere(
      user.id,
      null
    );
    if (hasActiveSession) {
      logger.auth(
        "User has active session elsewhere, logging out previous session"
      );
      await sessionManager.logoutUserFromAllDevices(user.id);
    }

    // Create new session
    const sessionId = authUtils.generateSessionId();
    const session = await sessionManager.createSession(
      user.id,
      sessionId,
      userAgent,
      ipAddress,
      {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      }
    );

    // Generate token
    const token = authUtils.generateToken(user, sessionId);

    logger.auth("User authenticated successfully", { email, role: user.role });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
      token,
      sessionId,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, error: "Authentication failed" };
  }
};

// Verify session
export const verifySession = async (token) => {
  try {
    const decoded = authUtils.verifyToken(token);
    if (!decoded) {
      return { success: false, error: "Invalid token" };
    }

    // Check if session is still valid
    if (!authUtils.isSessionValid(decoded.loginTime)) {
      logger.auth("Session expired", { email: decoded.email });
      await sessionManager.logoutSession(decoded.sessionId);
      return { success: false, error: "Session expired" };
    }

    // Check if session exists in active sessions or database
    let session = sessionManager.getSession(decoded.sessionId);

    // If session not found in memory, check database
    if (!session) {
      try {
        const dbSession = await prisma.userSession.findUnique({
          where: { id: decoded.sessionId },
          include: { user: true },
        });

        if (dbSession && dbSession.isActive) {
          // Recreate session in memory
          sessionManager.activeSessions.set(decoded.sessionId, {
            id: dbSession.id,
            userId: dbSession.userId,
            email: dbSession.user.email,
            role: dbSession.user.role,
            isActive: dbSession.isActive,
            lastActivity: dbSession.lastActivity,
            userAgent: dbSession.userAgent,
            ipAddress: dbSession.ipAddress,
          });
          session = sessionManager.getSession(decoded.sessionId);
        }
      } catch (dbError) {
        console.error("Database session check failed:", dbError);
        // Continue with memory-only check
      }
    }

    if (!session || !session.isActive) {
      return { success: false, error: "Session not found" };
    }

    // Update last activity
    sessionManager.updateActivity(decoded.sessionId);

    return {
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      },
      sessionId: decoded.sessionId,
    };
  } catch (error) {
    console.error("Session verification error:", error);
    return { success: false, error: "Session verification failed" };
  }
};

// Logout user
export const logoutUser = async (sessionId) => {
  try {
    await sessionManager.logoutSession(sessionId);
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: "Logout failed" };
  }
};
