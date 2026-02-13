import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventQuerySchema, DEFAULT_START_HOUR } from "@lecture-seeker/shared";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = eventQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { page, limit, startAfter, startBefore, source, eventType, location, isOnline, nights, weekends, q } = parsed.data;

  const where: Prisma.EventWhereInput = {};

  if (startAfter || startBefore) {
    where.startTime = {};
    if (startAfter) where.startTime.gte = startAfter;
    if (startBefore) where.startTime.lte = startBefore;
  }

  if (source) {
    where.source = { slug: source };
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  if (isOnline !== undefined) {
    where.isOnline = isOnline;
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  // Time-of-day and day-of-week filters require raw SQL (Prisma can't EXTRACT).
  // Get matching IDs first, then add to the Prisma where clause.
  // Column is timestamptz so a single AT TIME ZONE converts to Pacific local time.
  if (nights || weekends) {
    const pacificExpr = `"startTime" AT TIME ZONE 'America/Los_Angeles'`;
    const conditions: string[] = [];
    if (nights) {
      conditions.push(
        `EXTRACT(HOUR FROM ${pacificExpr}) >= ${DEFAULT_START_HOUR}`
      );
    }
    if (weekends) {
      // DOW: 0 = Sunday, 6 = Saturday
      conditions.push(
        `EXTRACT(DOW FROM ${pacificExpr}) IN (0, 6)`
      );
    }
    const ids = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "Event" WHERE ${conditions.join(" AND ")}`
    );
    where.id = { in: ids.map((r) => r.id) };
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { source: { select: { name: true, slug: true } } },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({
    data: events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
