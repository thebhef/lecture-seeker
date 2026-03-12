import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType, normalizeAudience, normalizeAgeGroup } from "@lecture-seeker/shared";

const API_BASE =
  "https://gateway.bibliocommons.com/v2/libraries/smcl/events";

interface BiblioEvent {
  id: string;
  key: string;
  seriesId: string;
  definition: {
    start: string;
    end: string;
    title: string;
    description?: string;
    branchLocationId?: string;
    nonBranchLocationId?: string;
    audienceIds?: string[];
    typeIds?: string[];
    isCancelled?: boolean;
    registrationInfo?: {
      provider?: string;
    };
    featuredImageId?: string;
    contact?: {
      email?: string;
      phone?: string;
      name?: string;
    };
  };
  isRecurring?: boolean;
  isFull?: boolean;
  registrationClosed?: boolean;
}

interface BiblioLocation {
  id: string;
  name: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  };
  latitude?: number;
  longitude?: number;
}

interface BiblioApiResponse {
  events: {
    items: string[];
    pagination: {
      count: number;
      pages: number;
      page: number;
      limit: number;
    };
  };
  entities: {
    events: Record<string, BiblioEvent>;
    eventSeries?: Record<string, unknown>;
    eventAudiences?: Record<string, { id: string; name: string }>;
    eventTypes?: Record<string, { id: string; name: string }>;
    locations?: Record<string, BiblioLocation>;
  };
}

export class SanMateoLibraryScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.SAN_MATEO_LIBRARY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${API_BASE}?limit=50&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.addError(`API returned ${res.status} on page ${page}`);
        break;
      }

      const data = (await res.json()) as BiblioApiResponse;
      totalPages = data.events.pagination.pages;

      const { events: eventEntities, eventAudiences, eventTypes, locations } =
        data.entities;

      for (const eventId of data.events.items) {
        const event = eventEntities[eventId];
        if (!event) continue;

        try {
          const normalized = this.normalizeEvent(
            event,
            eventTypes || {},
            eventAudiences || {},
            locations || {}
          );
          if (normalized) allEvents.push(normalized);
        } catch (err) {
          this.addError(`Failed to parse event ${eventId}: ${err}`);
        }
      }

      page++;
      if (page <= totalPages) await this.sleep(1000);
    } while (page <= totalPages);

    return allEvents;
  }

  private normalizeEvent(
    event: BiblioEvent,
    typeEntities: Record<string, { id: string; name: string }>,
    audienceEntities: Record<string, { id: string; name: string }>,
    locationEntities: Record<string, BiblioLocation>
  ): NormalizedEvent | null {
    const def = event.definition;
    if (!def.start) return null;

    // Resolve event type from typeIds
    let eventType: string | undefined;
    if (def.typeIds?.length) {
      for (const typeId of def.typeIds) {
        const typeEntity = typeEntities[typeId];
        if (typeEntity) {
          eventType = normalizeEventType(typeEntity.name);
          if (eventType) break;
        }
      }
    }

    // Resolve audience from audienceIds
    let audience: string | undefined;
    if (def.audienceIds?.length) {
      for (const audId of def.audienceIds) {
        const audEntity = audienceEntities[audId];
        if (audEntity) {
          audience = normalizeAudience(audEntity.name);
          if (audience) break;
        }
      }
    }

    // Resolve age group from audienceIds
    let ageGroup: string | undefined;
    if (def.audienceIds?.length) {
      for (const audId of def.audienceIds) {
        const audEntity = audienceEntities[audId];
        if (audEntity) {
          ageGroup = normalizeAgeGroup(audEntity.name);
          if (ageGroup) break;
        }
      }
    }

    // Resolve location
    let location: string | undefined;
    let address: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;

    const locId = def.branchLocationId || def.nonBranchLocationId;
    if (locId) {
      const loc = locationEntities[locId];
      if (loc) {
        location = loc.name;
        if (loc.address) {
          address = [loc.address.line1, loc.address.city, loc.address.region]
            .filter(Boolean)
            .join(", ");
        }
        latitude = loc.latitude;
        longitude = loc.longitude;
      }
    }

    // Strip HTML tags from description
    const description = def.description
      ? def.description.replace(/<[^>]*>/g, "").trim()
      : undefined;

    return {
      sourceEventId: event.id,
      title: def.title,
      description,
      descriptionHtml: def.description || undefined,
      startTime: new Date(def.start),
      endTime: def.end ? new Date(def.end) : undefined,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location,
      address,
      latitude,
      longitude,
      url: `https://smcl.bibliocommons.com/events/${event.id}`,
      isCanceled: def.isCancelled || false,
      isOnline: false,
      eventType,
      audience,
      ageGroup,
      subjects: [],
      rawData: event,
    };
  }
}
