import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType } from "@lecture-seeker/shared";

interface KipacApiResponse {
  data: KipacEvent[];
  meta: { count: number };
  links: { next?: { href: string } };
}

interface KipacEvent {
  id: string;
  attributes: {
    status: boolean;
    title: string;
    body?: { value?: string; processed?: string; summary?: string } | null;
    path?: { alias?: string } | null;
    su_event_alt_loc?: string | null;
    su_event_date_time?: {
      value: string;
      end_value?: string;
      duration?: number;
      timezone?: string;
    } | null;
  };
}

const PAGE_SIZE = 50;
const BASE_URL = "https://kipac.stanford.edu";
const API_URL = `${BASE_URL}/jsonapi/node/stanford_event`;

export class KipacScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.KIPAC;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    let offset = 0;
    let total = Infinity;

    do {
      const url = `${API_URL}?page[limit]=${PAGE_SIZE}&page[offset]=${offset}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.addError(`API returned ${res.status} at offset ${offset}`);
        break;
      }

      const data = (await res.json()) as KipacApiResponse;
      total = data.meta.count;

      for (const item of data.data) {
        try {
          const normalized = this.normalizeEvent(item);
          if (normalized) allEvents.push(normalized);
        } catch (err) {
          this.addError(`Failed to parse event ${item.id}: ${err}`);
        }
      }

      offset += PAGE_SIZE;
    } while (offset < total);

    return allEvents;
  }

  private normalizeEvent(item: KipacEvent): NormalizedEvent | null {
    const { attributes } = item;
    if (!attributes.status) return null;

    const dateTime = attributes.su_event_date_time;
    if (!dateTime?.value) return null;

    const bodyHtml = attributes.body?.value || attributes.body?.processed || undefined;
    const description = bodyHtml ? stripHtml(bodyHtml) : undefined;

    const eventUrl = attributes.path?.alias
      ? `${BASE_URL}${attributes.path.alias}`
      : undefined;

    const isOnline = bodyHtml
      ? /zoom\.us|teams\.microsoft|webex/i.test(bodyHtml)
      : false;

    return {
      sourceEventId: item.id,
      title: attributes.title,
      description,
      descriptionHtml: bodyHtml,
      startTime: new Date(dateTime.value),
      endTime: dateTime.end_value ? new Date(dateTime.end_value) : undefined,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: attributes.su_event_alt_loc || undefined,
      url: eventUrl,
      isCanceled: false,
      isOnline,
      eventType: inferEventType(attributes.title),
      audience: "academic",
      department: "KIPAC",
      subjects: [],
      rawData: item,
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferEventType(title: string): string | undefined {
  const lower = title.toLowerCase();
  if (/tea talk/i.test(lower)) return "lecture";
  if (/colloqui/i.test(lower)) return normalizeEventType("colloquium") ?? "conference";
  if (/thesis defense/i.test(lower)) return "lecture";
  if (/workshop/i.test(lower)) return "workshop";
  if (/conference/i.test(lower)) return "conference";
  // Most KIPAC events are academic talks/lectures
  return "lecture";
}
