import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";

const CSM_LOCATION = "College of San Mateo Observatory, Building 36, 4th Floor";
const CSM_ADDRESS = "1700 W Hillsdale Blvd, San Mateo, CA 94402";
const CSM_LAT = 37.5385;
const CSM_LNG = -122.4651;

export class CSMObservatoryScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.CSM_OBSERVATORY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch(
      "https://collegeofsanmateo.edu/astronomy/observatory.asp"
    );
    if (!res.ok) {
      throw new Error(`Page returned ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

    // Look for the schedule table with date/time rows
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      rows.each((i, row) => {
        if (i === 0) return; // skip header row

        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const dateText = $(cells[0]).text().trim();
        const timeText = $(cells[1]).text().trim();

        if (!dateText || !timeText) return;

        try {
          const parsed = this.parseDateAndTime(dateText, timeText);
          if (!parsed) return;

          events.push({
            sourceEventId: `csm-jazz-${parsed.start.toISOString().slice(0, 10)}`,
            title: "Jazz Under the Stars",
            description:
              "Free public stargazing event at the College of San Mateo Observatory. " +
              "Enjoy jazz music while viewing celestial objects through telescopes. " +
              "Weather permitting.",
            startTime: parsed.start,
            endTime: parsed.end,
            isAllDay: false,
            timezone: "America/Los_Angeles",
            location: CSM_LOCATION,
            address: CSM_ADDRESS,
            latitude: CSM_LAT,
            longitude: CSM_LNG,
            url: "https://collegeofsanmateo.edu/astronomy/observatory.asp",
            cost: "Free",
            isCanceled: false,
            isOnline: false,
            eventType: "astronomy",
            subjects: ["astronomy", "jazz", "stargazing"],
            rawData: { dateText, timeText },
          });
        } catch (err) {
          this.addError(`Failed to parse row: ${dateText} / ${timeText}: ${err}`);
        }
      });
    });

    // Also look for linked events from events.collegeofsanmateo.edu
    $('a[href*="events.collegeofsanmateo.edu"]').each((_, el) => {
      try {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (!href || !text) return;

        // These are typically holiday notices, not scrapeable events with full details
        // Skip them unless they have structured date info
      } catch (err) {
        this.addError(`Failed to parse linked event: ${err}`);
      }
    });

    return events;
  }

  private parseDateAndTime(
    dateText: string,
    timeText: string
  ): { start: Date; end: Date } | null {
    // dateText: "Jan 24", "Feb 21", "Mar 21", etc.
    // timeText: "7:00-9:00PM", "8:00-10:00PM", "Time TBD"

    if (timeText.toLowerCase().includes("tbd")) return null;

    const currentYear = new Date().getFullYear();

    // Parse month and day
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const dateMatch = dateText.match(/^(\w{3})\s+(\d{1,2})$/i);
    if (!dateMatch) return null;

    const month = monthNames[dateMatch[1].toLowerCase()];
    const day = parseInt(dateMatch[2], 10);
    if (month === undefined || isNaN(day)) return null;

    // Parse time range: "7:00-9:00PM"
    const timeMatch = timeText.match(
      /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!timeMatch) return null;

    let startHour = parseInt(timeMatch[1], 10);
    const startMin = parseInt(timeMatch[2], 10);
    let endHour = parseInt(timeMatch[3], 10);
    const endMin = parseInt(timeMatch[4], 10);
    const ampm = timeMatch[5].toUpperCase();

    // The end time has the AM/PM marker; for evening events both are PM
    if (ampm === "PM") {
      if (endHour < 12) endHour += 12;
      if (startHour < 12) startHour += 12;
    }

    const start = new Date(currentYear, month, day, startHour, startMin);
    const end = new Date(currentYear, month, day, endHour, endMin);

    return { start, end };
  }
}
