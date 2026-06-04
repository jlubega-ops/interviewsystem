// Cache control utilities to prevent stale data
import { NextResponse } from "next/server";

/**
 * Add cache control headers to prevent stale data
 * @param {NextResponse} response - The response object
 * @returns {NextResponse} - Response with cache control headers
 */
export function addNoCacheHeaders(response) {
  // Set aggressive no-cache headers
  response.headers.set(
    "Cache-Control",
    "no-cache, no-store, must-revalidate, max-age=0, private"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Last-Modified", new Date().toUTCString());
  response.headers.set("ETag", `"${Date.now()}"`);

  return response;
}

/**
 * Create a response with no-cache headers
 * @param {any} data - Response data
 * @param {number} status - HTTP status code
 * @returns {NextResponse} - Response with no-cache headers
 */
export function createNoCacheResponse(data, status = 200) {
  const response = NextResponse.json(data, { status });
  return addNoCacheHeaders(response);
}

/**
 * Add cache control headers to existing response
 * @param {Response} response - Existing response
 * @returns {Response} - Response with cache control headers
 */
export function setNoCacheHeaders(response) {
  response.headers.set(
    "Cache-Control",
    "no-cache, no-store, must-revalidate, max-age=0, private"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Last-Modified", new Date().toUTCString());
  response.headers.set("ETag", `"${Date.now()}"`);

  return response;
}

const cacheControl = {
  addNoCacheHeaders,
  createNoCacheResponse,
  setNoCacheHeaders,
};

export default cacheControl;
