import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS } from "@lecture-seeker/shared";

interface BerkeleyApiResponse {
  meta: { total_pages: number; page: number };
  data: BerkeleyEvent[];
}

interface BerkeleyEvent {
  id: number;
  title: string;
  url?: string;
  description?: string;
  date_utc?: string;
  date_iso?: string;
  date2_utc?: string;
  date2_iso?: string;
  date_ts?: number;
  date2_ts?: number;
  is_all_day?: number;
  is_canceled?: number;
  is_online?: number;
  online_url?: string;
  cost?: string;
  timezone?: string;
  location?: string;
  summary?: string;
}

export class UCBerkeleyScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.UC_BERKELEY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `https://events.berkeley.edu/live/json/events/page/${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.addError(`API returned ${res.status} on page ${page}`);
        break;
      }

      const data = (await res.json()) as BerkeleyApiResponse;
      totalPages = data.meta.total_pages;

      for (const item of data.data) {
        try {
          const normalized = this.normalizeEvent(item);
          if (normalized) allEvents.push(normalized);
        } catch (err) {
          this.addError(`Failed to parse event ${item.id}: ${err}`);
        }
      }

      page++;
    } while (page <= totalPages);

    return allEvents;
  }

  private normalizeEvent(event: BerkeleyEvent): NormalizedEvent | null {
    const startIso = event.date_utc || event.date_iso;
    if (!startIso) return null;

    let eventType: string | undefined;
    let title = event.title;

    // Berkeley often uses "Category | Title" format
    const pipeMatch = title.match(/^(.+?)\s*\|\s*(.+)$/);
    if (pipeMatch) {
      eventType = pipeMatch[1].trim().toLowerCase();
      title = pipeMatch[2].trim();
    }

    const endIso = event.date2_utc || event.date2_iso;

    return {
      sourceEventId: String(event.id),
      title,
      description: event.summary || event.description || undefined,
      startTime: new Date(startIso),
      endTime: endIso ? new Date(endIso) : undefined,
      isAllDay: event.is_all_day === 1,
      timezone: event.timezone || "America/Los_Angeles",
      location: event.location || undefined,
      url: event.url || undefined,
      ticketUrl: event.online_url || undefined,
      cost: event.cost || undefined,
      isCanceled: event.is_canceled === 1,
      isOnline: event.is_online === 1,
      eventType,
      subjects: [],
      rawData: event,
    };
  }
}
