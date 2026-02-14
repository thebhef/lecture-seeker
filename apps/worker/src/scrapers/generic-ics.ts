import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { inferAudienceFromText } from "@lecture-seeker/shared";
import ical from "node-ical";

export class GenericIcsScraper extends BaseScraper {
  sourceSlug: string;
  private url: string;

  constructor(slug: string, url: string) {
    super();
    this.sourceSlug = slug;
    this.url = url;
  }

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch(this.url);
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

    const location = typeof vevent.location === "string"
      ? vevent.location.replace(/\\,/g, ",").trim()
      : undefined;

    const url = typeof vevent.url === "string"
      ? vevent.url
      : (vevent.url as unknown as { val?: string })?.val || undefined;

    const description =
      typeof vevent.description === "string"
        ? vevent.description.replace(/\\n/g, "\n").trim()
        : undefined;

    const audience = inferAudienceFromText(
      `${vevent.summary || ""} ${description || ""}`
    );

    return {
      sourceEventId: uid,
      title: vevent.summary || "Untitled Event",
      description,
      startTime,
      endTime,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location,
      url,
      isCanceled: false,
      isOnline: false,
      audience,
      subjects: [],
      rawData: { uid, summary: vevent.summary },
    };
  }
}
