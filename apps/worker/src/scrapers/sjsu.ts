import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType, normalizeAudience, normalizeAgeGroup } from "@lecture-seeker/shared";

interface SjsuApiResponse {
  events: SjsuEvent[];
  page: { current: number; size: number; total: number };
}

interface SjsuEvent {
  event: {
    id: number;
    title: string;
    description_text?: string;
    description?: string;
    location_name?: string;
    room_number?: string;
    address?: string;
    geo?: { latitude?: string; longitude?: string };
    localist_url?: string;
    ticket_url?: string;
    ticket_cost?: string;
    free?: boolean;
    photo_url?: string;
    experience?: string;
    status?: string;
    recurring?: boolean;
    event_instances?: Array<{
      event_instance: {
        start: string;
        end?: string;
        all_day?: boolean;
      };
    }>;
    filters?: {
      event_types?: Array<{ name: string }>;
      event_target_audience?: Array<{ name: string }>;
      event_topic?: Array<{ name: string }>;
    };
    departments?: Array<{ name: string }>;
    keywords?: string[];
    tags?: string[];
  };
}

export class SjsuScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.SJSU;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `https://events.sjsu.edu/api/2/events?page=${page}&per_page=100&days=365`;
      const res = await fetch(url);
      if (!res.ok) {
        this.addError(`API returned ${res.status} on page ${page}`);
        break;
      }

      const data = (await res.json()) as SjsuApiResponse;
      totalPages = data.page.total;

      for (const item of data.events) {
        try {
          const normalized = this.normalizeEvent(item);
          if (normalized) allEvents.push(normalized);
        } catch (err) {
          this.addError(`Failed to parse event ${item.event?.id}: ${err}`);
        }
      }

      page++;
      if (page <= totalPages) await this.sleep(1000);
    } while (page <= totalPages);

    return allEvents;
  }

  private normalizeEvent(item: SjsuEvent): NormalizedEvent | null {
    const e = item.event;
    const instance = e.event_instances?.[0]?.event_instance;
    if (!instance?.start) return null;

    const location = [e.location_name, e.room_number]
      .filter(Boolean)
      .join(", ");

    const eventType =
      normalizeEventType(e.filters?.event_types?.[0]?.name);
    const audience = normalizeAudience(e.filters?.event_target_audience?.[0]?.name);
    const ageGroup = normalizeAgeGroup(e.filters?.event_target_audience?.[0]?.name);
    const subjects =
      e.filters?.event_topic?.map((s) => s.name) || [];
    const department = e.departments?.[0]?.name || undefined;

    return {
      sourceEventId: String(e.id),
      title: e.title,
      description: e.description_text || undefined,
      descriptionHtml: e.description || undefined,
      startTime: new Date(instance.start),
      endTime: instance.end ? new Date(instance.end) : undefined,
      isAllDay: instance.all_day || false,
      timezone: "America/Los_Angeles",
      location: location || undefined,
      address: e.address || undefined,
      latitude: e.geo?.latitude ? parseFloat(e.geo.latitude) : undefined,
      longitude: e.geo?.longitude ? parseFloat(e.geo.longitude) : undefined,
      url: e.localist_url || undefined,
      ticketUrl: e.ticket_url || undefined,
      imageUrl: e.photo_url || undefined,
      cost: e.free ? "Free" : e.ticket_cost || undefined,
      isCanceled: e.status === "canceled",
      isOnline:
        e.experience === "virtual" || e.experience === "hybrid",
      eventType,
      audience,
      ageGroup,
      subjects,
      department,
      rawData: item,
    };
  }
}
