import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType, inferAudienceFromText, inferAgeGroupFromText } from "@lecture-seeker/shared";
import ical from "node-ical";

const ICS_URL =
  "https://libraryca.libcal.com/ical_subscribe.php?src=p&cid=17752";

export class CalStateLibraryScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.CAL_STATE_LIBRARY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch(ICS_URL);
    if (!res.ok) {
      throw new Error(`ICS feed returned ${res.status}`);
    }

    const icsText = await res.text();
    const parsed = ical.sync.parseICS(icsText);
    const events: NormalizedEvent[] = [];

    for (const [key, component] of Object.entries(parsed)) {
      if (component.type !== "VEVENT") continue;

      try {
        const normalized = this.normalizeVEvent(key, component);
        if (normalized) events.push(normalized);
      } catch (err) {
        this.addError(`Failed to parse VEVENT ${key}: ${err}`);
      }
    }

    return events;
  }

  private normalizeVEvent(
    uid: string,
    vevent: ical.VEvent
  ): NormalizedEvent | null {
    if (!vevent.start) return null;

    const startTime =
      vevent.start instanceof Date
        ? vevent.start
        : new Date(vevent.start as unknown as string);

    let endTime: Date | undefined;
    if (vevent.end) {
      endTime =
        vevent.end instanceof Date
          ? vevent.end
          : new Date(vevent.end as unknown as string);
    }

    const title = vevent.summary || "Untitled Event";

    const description =
      typeof vevent.description === "string"
        ? vevent.description.replace(/\\n/g, "\n").trim()
        : undefined;

    const location =
      typeof vevent.location === "string"
        ? vevent.location.replace(/\\,/g, ",").trim()
        : undefined;

    const url =
      typeof vevent.url === "string"
        ? vevent.url
        : (vevent.url as unknown as { val?: string })?.val || undefined;

    const categories = this.extractCategories(vevent);
    const eventType = this.inferEventType(title, description, categories);
    const audience = inferAudienceFromText(`${title} ${description || ""}`);
    const ageGroup = inferAgeGroupFromText(`${title} ${description || ""}`);

    const isOnline =
      /\b(virtual|webinar|online|zoom|teams)\b/i.test(
        `${title} ${description || ""} ${location || ""}`
      );

    return {
      sourceEventId: uid,
      title,
      description,
      startTime,
      endTime,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: isOnline ? undefined : location,
      url,
      isCanceled: false,
      isOnline,
      eventType,
      audience,
      ageGroup,
      subjects: categories,
      rawData: { uid, summary: vevent.summary },
    };
  }

  private extractCategories(vevent: ical.VEvent): string[] {
    const cats = (vevent as unknown as Record<string, unknown>).categories;
    if (Array.isArray(cats)) return cats.map(String);
    if (typeof cats === "string") return cats.split(",").map((s) => s.trim());
    return [];
  }

  private inferEventType(
    title: string,
    description: string | undefined,
    categories: string[]
  ): string | undefined {
    // Try categories first
    for (const cat of categories) {
      const normalized = normalizeEventType(cat);
      if (normalized) return normalized;
    }

    // Keyword inference from title + description
    const text = `${title} ${description || ""}`.toLowerCase();

    if (/\b(webinar|briefing|presentation|demo|overview|talk|series)\b/.test(text)) {
      return "lecture";
    }
    if (/\b(workshop|hands-on|training)\b/.test(text)) {
      return "workshop";
    }
    if (/\b(exhibit|exhibition|gallery)\b/.test(text)) {
      return "exhibition";
    }
    if (/\b(film|screening|movie)\b/.test(text)) {
      return "film";
    }
    if (/\b(concert|music|performance|recital)\b/.test(text)) {
      return "performance";
    }
    if (/\b(conference|symposium|forum)\b/.test(text)) {
      return "conference";
    }
    if (/\b(social|reception|mixer|book club)\b/.test(text)) {
      return "social";
    }

    return undefined;
  }
}
