import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [eventTypes, sources, locations, audiences] = await Promise.all([
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
  ]);

  return NextResponse.json({
    eventTypes: eventTypes
      .map((e) => e.eventType)
      .filter(Boolean) as string[],
    sources: sources.map((s) => ({ slug: s.slug, name: s.name })),
    locations: locations
      .map((e) => e.location)
      .filter(Boolean) as string[],
    audiences: audiences
      .map((e) => e.audience)
      .filter(Boolean) as string[],
  });
}
