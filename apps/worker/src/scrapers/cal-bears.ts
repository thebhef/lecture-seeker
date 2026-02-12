import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS } from "@lecture-seeker/shared";
import ical from "node-ical";

export class CalBearsScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.CAL_BEARS;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch("https://calbears.com/calendar.ashx/calendar.ics");
    if (!res.ok) {
      throw new Error(`ICS feed returned ${res.status}`);
    }

    const icsText = await res.text();
    const parsed = ical.sync.parseICS(icsText);
    const events: NormalizedEvent[] = [];

    for (const [key, component] of Object.entries(parsed)) {
      if (component.type !== "VEVENT") continue;

      try {
        const normalized = this.normalizeEvent(key, component);
        if (normalized) events.push(normalized);
      } catch (err) {
        this.addError(`Failed to parse VEVENT ${key}: ${err}`);
      }
    }

    return events;
  }

  private normalizeEvent(
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

    const summary = vevent.summary || "";
    const sport = this.extractSport(summary);

    const location = typeof vevent.location === "string"
      ? vevent.location.replace(/\\,/g, ",").trim()
      : undefined;

    const url = typeof vevent.url === "string"
      ? vevent.url.replace(/&amp;/g, "&")
      : (vevent.url as unknown as { val?: string })?.val?.replace(/&amp;/g, "&") || undefined;

    return {
      sourceEventId: uid,
      title: summary,
      description:
        typeof vevent.description === "string"
          ? vevent.description.replace(/\\n/g, "\n").trim()
          : undefined,
      startTime,
      endTime,
      isAllDay: !!(vevent as unknown as Record<string, unknown>).datetype?.toString().includes("date"),
      timezone: "America/Los_Angeles",
      location,
      url,
      isCanceled: false,
      isOnline: false,
      eventType: "sports",
      subjects: sport ? [sport] : [],
      rawData: { uid, summary, location: vevent.location, start: vevent.start, end: vevent.end },
    };
  }

  private extractSport(summary: string): string | undefined {
    const patterns = [
      /women's basketball/i,
      /men's basketball/i,
      /baseball/i,
      /softball/i,
      /football/i,
      /women's soccer/i,
      /men's soccer/i,
      /volleyball/i,
      /swimming/i,
      /track & field/i,
      /gymnastics/i,
      /tennis/i,
      /water polo/i,
      /lacrosse/i,
      /rowing/i,
      /golf/i,
      /rugby/i,
      /field hockey/i,
    ];

    for (const pattern of patterns) {
      const match = summary.match(pattern);
      if (match) return match[0];
    }
    return undefined;
  }
}
