// HTML sanitization utilities for the interview system

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML content
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== "string") return "";

  // Basic HTML sanitization - remove dangerous tags and attributes
  return (
    html
      // Remove script tags completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove iframe tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      // Remove object tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      // Remove embed tags
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
      // Remove applet tags
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "")
      // Remove form tags
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      // Remove input tags
      .replace(/<input\b[^<]*>/gi, "")
      // Remove button tags
      .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, "")
      // Remove event handlers (onclick, onload, etc.)
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
      // Remove javascript: URLs
      .replace(/javascript:/gi, "")
      // Remove vbscript: URLs
      .replace(/vbscript:/gi, "")
      // Remove data: URLs
      .replace(/data:/gi, "")
      // Remove style attributes that could contain javascript
      .replace(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, "")
      // Remove href attributes with javascript
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, "")
      // Remove src attributes with javascript
      .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, "")
      // Clean up any remaining dangerous attributes
      .replace(/\s*(on\w+|style|href|src)\s*=\s*["'][^"']*["']/gi, "")
      .trim()
  );
};

/**
 * Strip HTML tags for plain-text display (e.g. in dropdowns, list previews).
 * @param {string} html - HTML or plain text
 * @returns {string} - Plain text with tags removed
 */
export const stripHtmlToText = (html) => {
  if (typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
};

/**
 * Validate and sanitize question text
 * @param {string} text - Question text to validate and sanitize
 * @returns {string} - Sanitized question text
 * @throws {Error} - If text is invalid
 */
export const validateQuestionText = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Question text is required");
  }

  const sanitized = sanitizeHtml(text);

  if (sanitized.length < 1) {
    throw new Error("Question text cannot be empty after sanitization");
  }

  if (sanitized.length > 2000) {
    throw new Error("Question text is too long (max 2000 characters)");
  }

  return sanitized;
};

/**
 * Basic input validation for common fields
 */
export const validateInput = {
  email: (email) => {
    if (!email || typeof email !== "string") {
      throw new Error("Email is required");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }
    if (email.length > 100) {
      throw new Error("Email is too long");
    }
    return email.trim().toLowerCase();
  },

  password: (password) => {
    if (!password || typeof password !== "string") {
      throw new Error("Password is required");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (password.length > 128) {
      throw new Error("Password is too long");
    }
    return password;
  },

  name: (name) => {
    if (!name || typeof name !== "string") {
      throw new Error("Name is required");
    }
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      throw new Error("Name cannot be empty");
    }
    if (trimmed.length > 100) {
      throw new Error("Name is too long");
    }
    // Allow letters, spaces, hyphens, and apostrophes
    if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
      throw new Error(
        "Name can only contain letters, spaces, hyphens, and apostrophes"
      );
    }
    return trimmed;
  },

  phone: (phone) => {
    if (!phone) return null; // Phone is optional
    if (typeof phone !== "string") {
      throw new Error("Phone must be a string");
    }
    const cleaned = phone.replace(/\D/g, ""); // Remove non-digits
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error("Invalid phone number format");
    }
    return phone.trim();
  },

  positiveInt: (value, fieldName = "Value") => {
    const num = parseInt(value);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return num;
  },

  nonEmptyString: (value, fieldName = "Field") => {
    if (!value || typeof value !== "string") {
      throw new Error(`${fieldName} is required`);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }
    return trimmed;
  },
};

/**
 * Sanitize user input for display
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeUserInput = (input) => {
  if (typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: URLs
    .replace(/vbscript:/gi, "") // Remove vbscript: URLs
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
};

const sanitizeUtils = {
  sanitizeHtml,
  validateQuestionText,
  validateInput,
  sanitizeUserInput,
};

export default sanitizeUtils;
