#!/bin/sh
set -e

echo "Pushing database schema..."
npx prisma db push --schema packages/shared/src/prisma/schema.prisma --skip-generate --accept-data-loss

echo "Starting worker..."
exec npx tsx apps/worker/src/index.ts
