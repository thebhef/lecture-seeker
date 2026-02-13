import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.calacademy.org";
const CALENDAR_PATH = "/daily-calendar-view";

const CAL_ACADEMY_LOCATION = "California Academy of Sciences";
const CAL_ACADEMY_ADDRESS = "55 Music Concourse Dr, San Francisco, CA 94118";
const CAL_ACADEMY_LAT = 37.7699;
const CAL_ACADEMY_LNG = -122.4661;

/** Number of days ahead to scrape from the daily calendar. */
const DAYS_AHEAD = 30;

/**
 * Formats a Date as YYYY-MM-DD for the calendar URL.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses time strings like "10:30 a.m.", "1 p.m.", "9:30 a.m." into hours/minutes.
 */
function parseTime(
  timeStr: string
): { hours: number; minutes: number } | null {
  // Match "10:30 a.m." or "1 p.m." or "9:30a.m." etc.
  const match = timeStr.match(
    /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)/i
  );
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].replace(/\./g, "").toLowerCase();

  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

export class CalAcademyScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.CAL_ACADEMY;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    const today = new Date();

    // Scrape each day's calendar page
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatDate(date);

      try {
        const dayEvents = await this.scrapeDayPage(date, dateStr);
        allEvents.push(...dayEvents);
      } catch (err) {
        this.addError(`Failed to scrape ${dateStr}: ${err}`);
      }
    }

    return allEvents;
  }

  private async scrapeDayPage(
    date: Date,
    dateStr: string
  ): Promise<NormalizedEvent[]> {
    const url = `${BASE_URL}${CALENDAR_PATH}/${dateStr}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      this.addError(`Calendar page ${dateStr} returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

    // Events are within the .view-daily-calendar container.
    // Each event block typically has a time heading, title link, location, description.
    // We look for links to /events/ paths as event anchors.
    const $rows = $(".view-content .views-row, .view-content .event-item, .view-content > div");

    if ($rows.length === 0) {
      // Fallback: try to find event links directly
      const $links = $('a[href*="/events/"]');
      $links.each((_, el) => {
        try {
          const event = this.parseEventFromLink($, $(el), date, dateStr);
          if (event) events.push(event);
        } catch (err) {
          this.addError(`Failed to parse event link on ${dateStr}: ${err}`);
        }
      });
      return events;
    }

    const seen = new Set<string>();

    $rows.each((_, row) => {
      try {
        const $row = $(row);

        // Find the event title link
        const $titleLink = $row.find('a[href*="/events/"]').first();
        if (!$titleLink.length) return;

        const href = $titleLink.attr("href") || "";
        const eventPath = href.replace(/^https?:\/\/[^/]+/, "");

        // Deduplicate by path + date
        const eventKey = `${eventPath}::${dateStr}`;
        if (seen.has(eventKey)) return;
        seen.add(eventKey);

        const title = $titleLink.text().trim();
        if (!title) return;

        // Skip generic museum operations entries
        if (/^museum\s+(opens?|closes?)/i.test(title)) return;

        // Extract time — look for time-like text in headings or time elements
        const timeText =
          $row.find("h3, .time, .views-field-field-time, time").first().text().trim() ||
          $row.text().match(/\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/i)?.[0] ||
          "";

        let startTime: Date;
        const parsedTime = parseTime(timeText);
        if (parsedTime) {
          startTime = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            parsedTime.hours,
            parsedTime.minutes
          );
        } else {
          // Default to 10am for events without a specific time
          startTime = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            10,
            0
          );
        }

        // Extract location/room
        const location =
          $row.find(".location, .field-name-field-location").text().trim() ||
          undefined;

        // Extract description
        const description =
          $row.find("p, .field-name-body, .description").first().text().trim() ||
          undefined;

        // Extract image
        const imageUrl =
          $row.find("img").first().attr("src") || undefined;

        const eventUrl = href.startsWith("http")
          ? href
          : `${BASE_URL}${eventPath}`;

        // Generate a stable source event ID from the path and date
        const sourceEventId = `${eventPath.replace(/^\/events\//, "").replace(/\//g, "-")}::${dateStr}`;

        // Try to infer event type from title/description
        const combinedText = `${title} ${description || ""}`.toLowerCase();
        let eventType = normalizeEventType(title);
        if (!eventType) {
          if (combinedText.includes("planetarium") || combinedText.includes("stars")) {
            eventType = "astronomy";
          } else if (combinedText.includes("lecture") || combinedText.includes("talk")) {
            eventType = "lecture";
          } else if (combinedText.includes("film") || combinedText.includes("screen")) {
            eventType = "film";
          } else if (combinedText.includes("exhibit")) {
            eventType = "exhibition";
          } else if (combinedText.includes("workshop") || combinedText.includes("class")) {
            eventType = "workshop";
          }
        }

        const subjects: string[] = [];
        if (location) subjects.push(location.toLowerCase());

        const fullLocation = location
          ? `${CAL_ACADEMY_LOCATION} — ${location}`
          : CAL_ACADEMY_LOCATION;

        events.push({
          sourceEventId,
          title,
          description,
          startTime,
          isAllDay: false,
          timezone: "America/Los_Angeles",
          location: fullLocation,
          address: CAL_ACADEMY_ADDRESS,
          latitude: CAL_ACADEMY_LAT,
          longitude: CAL_ACADEMY_LNG,
          url: eventUrl,
          imageUrl,
          isCanceled: false,
          isOnline: false,
          eventType,
          subjects,
          rawData: { dateStr, timeText, href, location },
        });
      } catch (err) {
        this.addError(`Failed to parse event on ${dateStr}: ${err}`);
      }
    });

    return events;
  }

  private parseEventFromLink(
    $: cheerio.CheerioAPI,
    $link: cheerio.Cheerio<cheerio.Element>,
    date: Date,
    dateStr: string
  ): NormalizedEvent | null {
    const href = $link.attr("href") || "";
    const title = $link.text().trim();
    if (!title || /^museum\s+(opens?|closes?)/i.test(title)) return null;

    const eventPath = href.replace(/^https?:\/\/[^/]+/, "");
    const sourceEventId = `${eventPath.replace(/^\/events\//, "").replace(/\//g, "-")}::${dateStr}`;
    const eventUrl = href.startsWith("http") ? href : `${BASE_URL}${eventPath}`;

    const startTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      10,
      0
    );

    return {
      sourceEventId,
      title,
      startTime,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: CAL_ACADEMY_LOCATION,
      address: CAL_ACADEMY_ADDRESS,
      latitude: CAL_ACADEMY_LAT,
      longitude: CAL_ACADEMY_LNG,
      url: eventUrl,
      isCanceled: false,
      isOnline: false,
      subjects: [],
      rawData: { dateStr, href },
    };
  }
}
