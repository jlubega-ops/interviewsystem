// Token validation utilities
import jwt from "jsonwebtoken";
import { config } from "./config";

const JWT_SECRET = config.jwt.secret;

export const tokenUtils = {
  // Check if token exists and is not expired
  isTokenValid: (token) => {
    if (!token) return false;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const now = Date.now();
      const tokenAge = now - decoded.loginTime;
      const maxAge = 60 * 60 * 1000; // 1 hour in milliseconds

      return tokenAge < maxAge;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  },

  // Get token info without throwing errors
  getTokenInfo: (token) => {
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
        loginTime: decoded.loginTime,
        isValid: true,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  },

  // Clear invalid token
  clearInvalidToken: () => {
    localStorage.removeItem("authToken");
    console.log("Cleared invalid token from localStorage");
  },
};

// Avoid only the most confusing: 0/O, 1/I, Q. L, Z, 2, S, 6, G, 8, B are allowed.
export const ACCESS_KEY_SAFE_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";

const ACCESS_KEY_DISALLOWED = ["0 (zero)", "O (letter O)", "1 (one)", "I (letter I)", "Q (letter Q)"];

/**
 * Validates that an access key contains only allowed characters (and "/").
 * Use when a user manually creates or edits an access key.
 * @returns {{ valid: true }} or {{ valid: false, error: string }}
 */
export function validateAccessKeyChars(accessKey) {
  if (!accessKey || typeof accessKey !== "string") {
    return { valid: false, error: "Access key is required." };
  }
  const trimmed = accessKey.trim().toUpperCase();
  const allowed = ACCESS_KEY_SAFE_CHARS + "/";
  const invalid = [];
  for (const char of trimmed) {
    if (!allowed.includes(char)) {
      if (!invalid.includes(char)) invalid.push(char);
    }
  }
  if (invalid.length === 0) return { valid: true };
  return {
    valid: false,
    error: `Access key contains invalid characters: ${invalid.join(", ")}. Do not use: ${ACCESS_KEY_DISALLOWED.join(", ")}. Use only letters and numbers that are easy to tell apart.`,
  };
}

// Generate a random access key for candidates with format MUBEIIC/2025/XXXXXX
export const generateAccessKey = () => {
  const currentYear = new Date().getFullYear();
  const prefix = "MUBEIIC";
  const year = currentYear.toString();

  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ACCESS_KEY_SAFE_CHARS.charAt(
      Math.floor(Math.random() * ACCESS_KEY_SAFE_CHARS.length)
    );
  }

  return `${prefix}/${year}/${suffix}`;
};

export default tokenUtils;
