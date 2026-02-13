import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventQuerySchema, TIME_OF_DAY } from "@lecture-seeker/shared";
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

  const { page, limit, startAfter, startBefore, source, eventType, location, isOnline, q, timeOfDay } = parsed.data;

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

  // Post-filter for time of day if needed (Prisma doesn't support EXTRACT on DateTime)
  let filteredEvents = events;
  if (timeOfDay) {
    const bucket = TIME_OF_DAY[timeOfDay];
    filteredEvents = events.filter((e) => {
      const hour = new Date(e.startTime).getUTCHours();
      return hour >= bucket.start && hour < bucket.end;
    });
  }

  return NextResponse.json({
    data: filteredEvents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
