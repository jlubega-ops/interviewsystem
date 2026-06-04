// Simple logging utility for the interview system
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = {
  // Log important authentication events
  auth: (message, data = {}) => {
    if (isDevelopment) {
      console.log(`🔐 AUTH: ${message}`, data);
    }
  },

  // Log important system events
  system: (message, data = {}) => {
    if (isDevelopment) {
      console.log(`⚙️ SYSTEM: ${message}`, data);
    }
  },

  // Log errors (always)
  error: (message, error = null) => {
    console.error(`❌ ERROR: ${message}`, error);
  },

  // Log warnings (always)
  warn: (message, data = {}) => {
    console.warn(`⚠️ WARN: ${message}`, data);
  },

  // Log candidate events
  candidate: (message, data = {}) => {
    if (isDevelopment) {
      console.log(`👤 CANDIDATE: ${message}`, data);
    }
  },

  // Log interview events
  interview: (message, data = {}) => {
    if (isDevelopment) {
      console.log(`📝 INTERVIEW: ${message}`, data);
    }
  },
};

export default logger;
