import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType } from "@lecture-seeker/shared";

const VENUE_URL =
  "https://www.livenation.com/venue/KovZpZA6ta1A/shoreline-amphitheatre-events";
const VENUE_DISCOVERY_ID = "KovZpZA6ta1A";

const SHORELINE_LOCATION = "Shoreline Amphitheatre";
const SHORELINE_ADDRESS = "One Amphitheatre Parkway, Mountain View, CA 94043";
const SHORELINE_LAT = 37.426718;
const SHORELINE_LNG = -122.080722;

/** Maps LiveNation segment values to our canonical event types. */
function mapSegmentToEventType(
  segment: string | undefined,
  genre: string | undefined
): string | undefined {
  if (!segment) return undefined;
  const lower = segment.toLowerCase();
  if (lower === "music") return "concert";
  // Try normalizing the genre (e.g. "Comedy" → "performance")
  return normalizeEventType(genre) ?? normalizeEventType(segment) ?? undefined;
}

interface LiveNationEvent {
  event_data_type: string;
  discovery_id: string;
  name: string;
  slug: string;
  url: string;
  type: string;
  start_date_local: string;
  start_time_local?: string;
  timezone: string;
  start_datetime_utc: string;
  status_code: string;
  genre?: string;
  segment?: string;
  is_virtual?: boolean;
  span_multiple_days?: boolean;
  venue?: {
    discovery_id: string;
    name: string;
    location?: {
      locality: string;
      region: string;
      street_address: string;
      postal_code: string;
      latitude: number;
      longitude: number;
    };
  };
  artists?: Array<{
    name: string;
    genre?: string;
  }>;
  images?: Array<{
    url: string;
    width: number;
    height: number;
    identifier: string;
  }>;
  image?: {
    url: string;
  };
}

export class ShorelineAmphitheatreScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.SHORELINE_AMPHITHEATRE;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch(VENUE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`LiveNation page returned ${res.status}`);
    }

    const html = await res.text();
    const rawEvents = this.extractEventsFromRSC(html);

    // Filter to regular events only and verify they're at Shoreline MV
    const regularEvents = rawEvents.filter((e) => {
      if (e.type !== "REGULAR") return false;
      // Verify venue is Shoreline Amphitheatre in Mountain View
      if (e.venue?.discovery_id && e.venue.discovery_id !== VENUE_DISCOVERY_ID) {
        return false;
      }
      return true;
    });

    return regularEvents.map((e) => this.normalize(e));
  }

  /**
   * Extracts event JSON from the React Server Component flight payload
   * embedded in the LiveNation page HTML.
   */
  private extractEventsFromRSC(html: string): LiveNationEvent[] {
    // Find RSC push chunks: self.__next_f.push([1,"..."])
    const chunkPattern = /self\.__next_f\.push\(\[1,"(.*?)"\]\)<\/script>/gs;
    let match: RegExpExecArray | null;

    while ((match = chunkPattern.exec(html)) !== null) {
      const content = match[1];
      if (!content.includes("event_data_type")) continue;

      // Unescape the RSC string (escaped quotes, backslashes)
      let unescaped: string;
      try {
        unescaped = content.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      } catch {
        this.addError("Failed to unescape RSC payload");
        continue;
      }

      // Find the "data":[ array within the getVenueEvents response
      const dataIdx = unescaped.indexOf('"data":[{');
      if (dataIdx < 0) continue;

      const arrStart = unescaped.indexOf("[", dataIdx);
      if (arrStart < 0) continue;

      // Find matching closing bracket
      let depth = 0;
      let i = arrStart;
      while (i < unescaped.length) {
        const c = unescaped[i];
        if (c === "[") depth++;
        else if (c === "]") {
          depth--;
          if (depth === 0) break;
        } else if (c === "\\") {
          i++; // skip escaped char
        }
        i++;
      }

      const arrStr = unescaped.slice(arrStart, i + 1);
      try {
        const events: LiveNationEvent[] = JSON.parse(arrStr);
        return events;
      } catch (err) {
        this.addError(`Failed to parse event JSON: ${err}`);
      }
    }

    this.addError("No event data found in LiveNation page RSC payload");
    return [];
  }

  private normalize(e: LiveNationEvent): NormalizedEvent {
    const startTime = new Date(e.start_datetime_utc);

    // Pick the best image (prefer RETINA_PORTRAIT for reasonable size)
    const imageUrl =
      e.images?.find((img) => img.identifier === "RETINA_PORTRAIT_16_9")?.url ??
      e.image?.url;

    // Build artist list for subjects
    const artistNames = e.artists?.map((a) => a.name) ?? [];

    const subjects: string[] = [];
    if (e.genre) subjects.push(e.genre.toLowerCase());
    if (e.segment && e.segment.toLowerCase() !== e.genre?.toLowerCase()) {
      subjects.push(e.segment.toLowerCase());
    }
    for (const name of artistNames) {
      subjects.push(name.toLowerCase());
    }

    return {
      sourceEventId: e.discovery_id,
      title: e.name,
      startTime,
      isAllDay: false,
      timezone: e.timezone || "America/Los_Angeles",
      location: SHORELINE_LOCATION,
      address: SHORELINE_ADDRESS,
      latitude: e.venue?.location?.latitude ?? SHORELINE_LAT,
      longitude: e.venue?.location?.longitude ?? SHORELINE_LNG,
      url: e.url,
      ticketUrl: e.url,
      imageUrl,
      isCanceled: e.status_code === "cancelled",
      isOnline: e.is_virtual ?? false,
      eventType: mapSegmentToEventType(e.segment, e.genre),
      subjects,
      rawData: e,
    };
  }
}
