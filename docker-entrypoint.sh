#!/bin/sh
set -e

echo "Applying database schema (prisma db push)..."
npx prisma db push --skip-generate

echo "Starting Next.js server on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
