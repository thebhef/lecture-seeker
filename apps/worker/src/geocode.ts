import { PrismaClient } from "@prisma/client";

const NOMINATIM_BASE =
  process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT = "LectureSeeker/1.0 (event-aggregator; github.com/thebhef/lecture-seeker)";
// Public Nominatim: max 1 req/sec. Self-hosted: no limit needed.
const isSelfHosted = !NOMINATIM_BASE.includes("openstreetmap.org");
const RATE_LIMIT_MS = isSelfHosted ? 50 : 1100;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

type GeoSearchResult =
  | { status: "found"; latitude: number; longitude: number; label: string }
  | { status: "not_found" }  // Nominatim returned 200 but 0 results — safe to cache
  | { status: "error" };     // Transient failure — do NOT cache

async function nominatimSearch(query: string): Promise<GeoSearchResult> {
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  // Bias results toward California / Bay Area
  url.searchParams.set("viewbox", "-123.0,38.5,-121.0,36.5");
  url.searchParams.set("bounded", "0");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { status: "error" };
  }

  if (!res.ok) return { status: "error" };

  const data = (await res.json()) as NominatimResult[];
  if (data.length === 0) return { status: "not_found" };

  return {
    status: "found",
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    label: data[0].display_name,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalizes a location string for cache lookup.
 * Strips extra whitespace and lowercases.
 */
function normalizeCacheKey(location: string): string {
  return location.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Geocodes all events that have a location string but no coordinates.
 * Uses a GeoCache table to avoid re-querying Nominatim for the same location.
 */
export async function geocodeUnmappedEvents(prisma: PrismaClient) {
  // Find distinct location strings that lack coordinates
  const unmapped = await prisma.$queryRaw<
    { location: string; address: string | null }[]
  >`
    SELECT DISTINCT e."location", e."address"
    FROM "Event" e
    WHERE e."latitude" IS NULL
      AND e."longitude" IS NULL
      AND e."location" IS NOT NULL
      AND e."location" != ''
      AND e."isOnline" = false
  `;

  if (unmapped.length === 0) {
    console.log("Geocode: all events with locations have coordinates");
    return;
  }

  // Check how many are already cached
  const cachedCount = await prisma.geoCache.count();
  const estMinutes = Math.ceil((unmapped.length * RATE_LIMIT_MS) / 60000);
  console.log(
    `Geocode: ${unmapped.length} distinct locations need coordinates (${cachedCount} cached). ` +
      `Using ${isSelfHosted ? "self-hosted" : "public"} Nominatim (${NOMINATIM_BASE}). ` +
      `Worst case ~${estMinutes} min for uncached lookups.`
  );

  let cached = 0;
  let fetched = 0;
  let notFound = 0;
  let errors = 0;
  let updated = 0;

  for (const { location, address } of unmapped) {
    const cacheKey = normalizeCacheKey(location);

    // Check cache first
    let entry = await prisma.geoCache.findUnique({
      where: { query: cacheKey },
    });

    if (!entry) {
      // Use the best available query: address if present, otherwise location string
      const query = address || location;
      const result = await nominatimSearch(query);
      await sleep(RATE_LIMIT_MS);

      if (result.status === "error") {
        // Transient failure — skip this location, don't cache. Will retry next run.
        errors++;
        continue;
      }

      entry = await prisma.geoCache.create({
        data: {
          query: cacheKey,
          latitude: result.status === "found" ? result.latitude : null,
          longitude: result.status === "found" ? result.longitude : null,
          label: result.status === "found" ? result.label : null,
          notFound: result.status === "not_found",
        },
      });

      fetched++;
      if (result.status === "not_found") {
        notFound++;
        continue;
      }
    } else {
      cached++;
      if (entry.notFound) continue;
    }

    if (entry.latitude == null || entry.longitude == null) continue;

    // Update all events with this location that lack coordinates
    const { count } = await prisma.event.updateMany({
      where: {
        location: { equals: location },
        latitude: null,
        longitude: null,
      },
      data: {
        latitude: entry.latitude,
        longitude: entry.longitude,
      },
    });
    updated += count;
  }

  console.log(
    `Geocode: done. ${cached} cached, ${fetched} fetched (${notFound} not found, ${errors} errors), ${updated} events updated`
  );
}
