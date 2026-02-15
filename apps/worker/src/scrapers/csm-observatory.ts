import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";
import { pacificDate } from "./timezone";

const CSM_OBSERVATORY_LOCATION =
  "College of San Mateo Observatory, Building 36, 4th Floor";
const CSM_PLANETARIUM_LOCATION = "College of San Mateo Planetarium, Building 36";
const CSM_ADDRESS = "1700 W Hillsdale Blvd, San Mateo, CA 94402";
const CSM_LAT = 37.5385;
const CSM_LNG = -122.4651;

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse "Jan 24", "March 13", "February 6", etc. into { month, day }.
 * Returns null if the text doesn't match (e.g. "No Show in February").
 */
function parseMonthDay(text: string): { month: number; day: number } | null {
  const m = text.match(/^(\w+)\s+(\d{1,2})$/i);
  if (!m) return null;
  const month = MONTH_NAMES[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  if (month === undefined || isNaN(day)) return null;
  return { month, day };
}

export class CSMObservatoryScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.CSM_OBSERVATORY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const [observatoryEvents, planetariumEvents] = await Promise.all([
      this.scrapeObservatoryPage(),
      this.scrapePlanetariumPage(),
    ]);

    return [...observatoryEvents, ...planetariumEvents];
  }

  // ── Observatory page (Jazz Under the Stars) ──────────────────────

  private async scrapeObservatoryPage(): Promise<NormalizedEvent[]> {
    let res: Response;
    try {
      res = await fetch(
        "https://collegeofsanmateo.edu/astronomy/observatory.asp"
      );
    } catch (err) {
      this.addError(`Observatory page fetch failed: ${err}`);
      return [];
    }
    if (!res.ok) {
      this.addError(`Observatory page returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

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
          const parsed = this.parseObservatoryDateTime(dateText, timeText);
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
            location: CSM_OBSERVATORY_LOCATION,
            address: CSM_ADDRESS,
            latitude: CSM_LAT,
            longitude: CSM_LNG,
            url: "https://collegeofsanmateo.edu/astronomy/observatory.asp",
            cost: "Free",
            isCanceled: false,
            isOnline: false,
            eventType: "astronomy",
            audience: "public",
            subjects: ["astronomy", "jazz", "stargazing"],
            rawData: { dateText, timeText },
          });
        } catch (err) {
          this.addError(
            `Failed to parse observatory row: ${dateText} / ${timeText}: ${err}`
          );
        }
      });
    });

    return events;
  }

  private parseObservatoryDateTime(
    dateText: string,
    timeText: string
  ): { start: Date; end: Date } | null {
    if (timeText.toLowerCase().includes("tbd")) return null;

    const parsed = parseMonthDay(dateText);
    if (!parsed) return null;

    const timeMatch = timeText.match(
      /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!timeMatch) return null;

    let startHour = parseInt(timeMatch[1], 10);
    const startMin = parseInt(timeMatch[2], 10);
    let endHour = parseInt(timeMatch[3], 10);
    const endMin = parseInt(timeMatch[4], 10);
    const ampm = timeMatch[5].toUpperCase();

    if (ampm === "PM") {
      if (endHour < 12) endHour += 12;
      if (startHour < 12) startHour += 12;
    }

    const currentYear = new Date().getFullYear();
    const start = pacificDate(
      currentYear, parsed.month, parsed.day, startHour, startMin
    );
    const end = pacificDate(
      currentYear, parsed.month, parsed.day, endHour, endMin
    );

    return { start, end };
  }

  // ── Planetarium page (The Sky Tonight + SMCAS talks) ─────────────

  private async scrapePlanetariumPage(): Promise<NormalizedEvent[]> {
    let res: Response;
    try {
      res = await fetch(
        "https://collegeofsanmateo.edu/astronomy/planetarium.asp"
      );
    } catch (err) {
      this.addError(`Planetarium page fetch failed: ${err}`);
      return [];
    }
    if (!res.ok) {
      this.addError(`Planetarium page returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return this.parsePlanetariumPage(html);
  }

  parsePlanetariumPage(html: string): NormalizedEvent[] {
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];
    const currentYear = new Date().getFullYear();

    $("table").each((_, table) => {
      const headerCells = $(table).find("tr:first-child td, tr:first-child th");
      const secondColHeader = headerCells.length >= 2
        ? $(headerCells[1]).text().trim().toLowerCase()
        : "";

      const isSpeakerTable = secondColHeader.includes("speaker");

      const rows = $(table).find("tr");
      rows.each((i, row) => {
        if (i === 0) return; // skip header

        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const dateText = $(cells[0]).text().trim();
        const detailText = $(cells[1]).text().trim();

        const parsed = parseMonthDay(dateText);
        if (!parsed) return; // skips "No Show in ..." / "No talk in ..." rows

        try {
          if (isSpeakerTable) {
            events.push(
              this.buildSmcasEvent(parsed, detailText, currentYear)
            );
          } else {
            events.push(
              this.buildPlanetariumEvent(parsed, detailText, currentYear)
            );
          }
        } catch (err) {
          this.addError(
            `Failed to parse planetarium row: ${dateText} / ${detailText}: ${err}`
          );
        }
      });
    });

    return events;
  }

  private buildPlanetariumEvent(
    date: { month: number; day: number },
    showTitle: string,
    year: number
  ): NormalizedEvent {
    const title =
      showTitle && showTitle.toLowerCase() !== "tbd"
        ? `The Sky Tonight: ${showTitle}`
        : "The Sky Tonight";

    // Two shows: 7 PM and 8 PM, each ~1 hour. Span the full window.
    const start = pacificDate(year, date.month, date.day, 19, 0);
    const end = pacificDate(year, date.month, date.day, 21, 0);

    return {
      sourceEventId: `csm-planetarium-${start.toISOString().slice(0, 10)}`,
      title,
      description:
        'Free planetarium show "The Sky Tonight" at the College of San Mateo. ' +
        "Two shows at 7:00 PM and 8:00 PM. 95 seats, first-come first-served. " +
        "Doors lock at show time. Children 5 years and older please.",
      startTime: start,
      endTime: end,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: CSM_PLANETARIUM_LOCATION,
      address: CSM_ADDRESS,
      latitude: CSM_LAT,
      longitude: CSM_LNG,
      url: "https://collegeofsanmateo.edu/astronomy/planetarium.asp",
      cost: "Free",
      isCanceled: false,
      isOnline: false,
      eventType: "astronomy",
      audience: "public",
      subjects: ["astronomy", "planetarium", "stargazing"],
      rawData: { dateText: `${date.month + 1}/${date.day}`, showTitle },
    };
  }

  private buildSmcasEvent(
    date: { month: number; day: number },
    speakerText: string,
    year: number
  ): NormalizedEvent {
    const hasSpeaker =
      speakerText && speakerText.toLowerCase() !== "tbd";

    const title = hasSpeaker
      ? `SMCAS: ${speakerText}`
      : "SMCAS Monthly Meeting";

    // Meeting at 7 PM, public talk ~8 PM, typically ~1 hour
    const start = pacificDate(year, date.month, date.day, 19, 0);
    const end = pacificDate(year, date.month, date.day, 21, 0);

    return {
      sourceEventId: `csm-smcas-${start.toISOString().slice(0, 10)}`,
      title,
      description:
        "San Mateo County Astronomical Society monthly meeting and public talk " +
        "at the College of San Mateo Planetarium. Meeting begins at 7 PM, " +
        "followed by a public talk around 8 PM. Free and open to the public.",
      startTime: start,
      endTime: end,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: CSM_PLANETARIUM_LOCATION,
      address: CSM_ADDRESS,
      latitude: CSM_LAT,
      longitude: CSM_LNG,
      url: "https://collegeofsanmateo.edu/astronomy/planetarium.asp",
      cost: "Free",
      isCanceled: false,
      isOnline: false,
      eventType: "lecture",
      audience: "public",
      subjects: ["astronomy"],
      rawData: { dateText: `${date.month + 1}/${date.day}`, speakerText },
    };
  }
}
