import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NOMINATIM_BASE =
  process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT =
  "LectureSeeker/1.0 (event-aggregator; github.com/thebhef/lecture-seeker)";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function normalizeCacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * GET /api/geocode?q=Oakland
 * Returns { latitude, longitude, label } or { error } with caching via GeoCache.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Missing 'q' parameter" },
      { status: 400 }
    );
  }

  const cacheKey = normalizeCacheKey(q);

  // Check cache
  const cached = await prisma.geoCache.findUnique({
    where: { query: cacheKey },
  });

  if (cached) {
    if (cached.notFound) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      latitude: cached.latitude,
      longitude: cached.longitude,
      label: cached.label,
    });
  }

  // Query Nominatim
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding service unavailable" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as NominatimResult[];

    if (data.length === 0) {
      // Cache the miss so we don't re-query
      await prisma.geoCache.create({
        data: { query: cacheKey, notFound: true },
      });
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      label: data[0].display_name,
    };

    // Cache the hit
    await prisma.geoCache.create({
      data: {
        query: cacheKey,
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
      },
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 }
    );
  }
}
