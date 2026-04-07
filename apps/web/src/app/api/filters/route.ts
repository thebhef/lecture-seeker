import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAudience, normalizeEventType, normalizeAgeGroup } from "@lecture-seeker/shared";

export async function GET() {
  const [eventTypes, sources, locations, audiences, ageGroupRows] = await Promise.all([
    prisma.event.findMany({
      where: { eventType: { not: null } },
      select: { eventType: true },
      distinct: ["eventType"],
      orderBy: { eventType: "asc" },
    }),
    prisma.source.findMany({
      select: { slug: true, name: true },
      where: { enabled: true },
      orderBy: { name: "asc" },
    }),
    prisma.event.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
      take: 100,
    }),
    prisma.event.findMany({
      where: { audience: { not: null } },
      select: { audience: true },
      distinct: ["audience"],
      orderBy: { audience: "asc" },
    }),
    // For array columns, query distinct values via raw SQL
    prisma.$queryRaw<{ val: string }[]>`
      SELECT DISTINCT unnest("ageGroups") AS val FROM "Event" ORDER BY val
    `,
  ]);

  return NextResponse.json({
    eventTypes: [...new Set(
      eventTypes.map((e) => normalizeEventType(e.eventType)).filter(Boolean)
    )] as string[],
    sources: sources.map((s) => ({ slug: s.slug, name: s.name })),
    locations: locations
      .map((e) => e.location)
      .filter(Boolean) as string[],
    audiences: [...new Set(
      audiences.map((e) => normalizeAudience(e.audience)).filter(Boolean)
    )] as string[],
    ageGroups: [...new Set(
      ageGroupRows.map((r) => {
        // "unclassified" is a real value, pass it through
        if (r.val === "unclassified") return r.val;
        return normalizeAgeGroup(r.val);
      }).filter(Boolean)
    )] as string[],
  });
}
