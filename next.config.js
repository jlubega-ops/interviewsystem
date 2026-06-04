/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Node.js runtime for all API routes by default
  serverExternalPackages: ["mysql2", "bcryptjs"],

  // Disable caching to prevent stale data
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },

  // Disable static optimization for dynamic content
  trailingSlash: false,
};

module.exports = nextConfig;
