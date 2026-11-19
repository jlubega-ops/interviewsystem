const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "span",
  "div",
  "blockquote",
  "code",
  "pre",
  "a",
  "sub",
  "sup",
]);

const VOID_TAGS = new Set(["br"]);

const ALLOWED_ATTR = {
  a: new Set(["href", "target", "rel"]),
  span: new Set(["class", "style"]),
  p: new Set(["class", "style"]),
  div: new Set(["class", "style"]),
  h1: new Set(["class", "style"]),
  h2: new Set(["class", "style"]),
  h3: new Set(["class", "style"]),
  h4: new Set(["class", "style"]),
  h5: new Set(["class", "style"]),
  h6: new Set(["class", "style"]),
};

const SAFE_URI = /^(?:https?:|mailto:|\/|#)/i;
const UNSAFE_CSS = /expression|url\s*\(|javascript:|behavior|@import/i;

function decodeAttr(value) {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function sanitizeStyle(value) {
  const decoded = decodeAttr(value);
  if (UNSAFE_CSS.test(decoded)) return null;
  return decoded.replace(/["<>]/g, "");
}

function sanitizeHref(value) {
  const decoded = decodeAttr(value).trim();
  if (!SAFE_URI.test(decoded)) return null;
  return decoded;
}

function sanitizeAttributes(tag, rawAttrs) {
  const allowed = ALLOWED_ATTR[tag];
  if (!allowed || !rawAttrs) return "";

  let out = "";
  const attrRe = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = attrRe.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (name.startsWith("on") || name.startsWith("xmlns") || name === "srcdoc") continue;
    if (!allowed.has(name)) continue;
    let value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name === "href") {
      value = sanitizeHref(value);
      if (!value) continue;
      out += ` href="${value.replace(/"/g, "&quot;")}"`;
      if (tag === "a") out += ` rel="noopener noreferrer"`;
      continue;
    }
    if (name === "target") {
      if (value !== "_blank" && value !== "_self") continue;
      out += ` target="${value}"`;
      continue;
    }
    if (name === "style") {
      value = sanitizeStyle(value);
      if (!value) continue;
      out += ` style="${value.replace(/"/g, "&quot;")}"`;
      continue;
    }
    if (name === "class") {
      const cls = value.replace(/[^a-zA-Z0-9 _-]/g, "");
      if (!cls) continue;
      out += ` class="${cls}"`;
    }
  }
  return out;
}

/**
 * Allowlist HTML sanitizer. Unknown tags/attributes are dropped.
 * @param {string} html
 * @returns {string}
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== "string") return "";

  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  return withoutComments
    .replace(/<(\/)?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, closing, rawTag, rawAttrs) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      const attrs = sanitizeAttributes(tag, rawAttrs);
      if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`;
      return `<${tag}${attrs}>`;
    })
    .trim();
};

/**
 * Strip HTML tags for plain-text display (e.g. in dropdowns, list previews).
 * @param {string} html - HTML or plain text
 * @returns {string} - Plain text with tags removed
 */
export const stripHtmlToText = (html) => htmlToPlainText(html);

const GLUED_BLOCK_TAGS = "p|div|span|h[1-6]|ul|ol|li|blockquote|pre";

/**
 * Plain text from rich-editor HTML, including values that lost < > on save
 * (e.g. "pThis is an interview/p").
 * Do not treat single-letter tags like s/u/b/i as glued prefixes — that
 * would strip "Select" to "elect" and "Submit" to "bmit".
 */
export const htmlToPlainText = (value) => {
  if (typeof value !== "string") return "";
  let s = value;
  if (/<[a-z][\s\S]*>/i.test(s)) {
    s = s.replace(/<[^>]*>/g, " ");
  } else {
    const open = new RegExp(`^(?:${GLUED_BLOCK_TAGS})(?=[A-Z0-9“"'(])`);
    const close = new RegExp(`\\/(?:${GLUED_BLOCK_TAGS})\\s*$`);
    const glued = new RegExp(`\\/(?:${GLUED_BLOCK_TAGS})(?:${GLUED_BLOCK_TAGS})`, "g");
    s = s.replace(open, "");
    s = s.replace(glued, " ");
    s = s.replace(close, "");
  }
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
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
