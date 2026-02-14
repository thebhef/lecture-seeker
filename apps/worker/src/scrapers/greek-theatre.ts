import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";
import { pacificDate } from "./timezone";

const CALENDAR_URL = "https://thegreekberkeley.com/calendar/";

const GREEK_LOCATION = "Greek Theatre";
const GREEK_ADDRESS = "2001 Gayley Road, Berkeley, CA 94720";
const GREEK_LAT = 37.8741;
const GREEK_LNG = -122.2538;

/**
 * Parses a date string like "Thu Apr 16" into a Date for the next occurrence
 * of that month/day (current year or next year if the date has passed).
 */
function parseEventDate(dateText: string): Date | null {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Match patterns like "Thu Apr 16" or "Apr 16"
  const match = dateText.match(/(\w{3})\s+(\d{1,2})$/);
  if (!match) return null;

  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2], 10);

  // If the first token is a day-of-week abbreviation, monthStr is the second token
  // The regex already captures the last "Word Number" pair, so check months first
  let month = months[monthStr];
  if (month === undefined) {
    // Try matching with day-of-week prefix: "Thu Apr 16"
    const fullMatch = dateText.match(/\w+\s+(\w{3})\s+(\d{1,2})$/);
    if (!fullMatch) return null;
    month = months[fullMatch[1].toLowerCase()];
    if (month === undefined) return null;
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = pacificDate(year, month, day);
  // If the date is more than 2 months in the past, assume next year
  if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
    year++;
  }

  return pacificDate(year, month, day);
}

/**
 * Parses time text like "Doors: 5:30 pm Show: 7:00 pm" and returns
 * { doors, show } as hour/minute pairs. Returns show time as the event start.
 */
function parseShowTime(
  timeText: string
): { hours: number; minutes: number } | null {
  // Look for "Show: H:MM pm" or just "H:MM pm/am"
  const showMatch = timeText.match(
    /Show:\s*(\d{1,2}):(\d{2})\s*(am|pm)/i
  );
  if (showMatch) {
    let hours = parseInt(showMatch[1], 10);
    const minutes = parseInt(showMatch[2], 10);
    const ampm = showMatch[3].toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Fallback: look for "Doors: H:MM pm" if no Show time
  const doorsMatch = timeText.match(
    /Doors:\s*(\d{1,2}):(\d{2})\s*(am|pm)/i
  );
  if (doorsMatch) {
    let hours = parseInt(doorsMatch[1], 10);
    const minutes = parseInt(doorsMatch[2], 10);
    const ampm = doorsMatch[3].toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  return null;
}

export class GreekTheatreScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.GREEK_THEATRE;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const res = await fetch(CALENDAR_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Greek Theatre page returned ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

    // Each event is a block containing an image link, title, date, time, and ticket info.
    // We look for links to individual event pages as the primary anchor.
    const eventLinks = $('a[href*="/events/"]');
    const seen = new Set<string>();

    eventLinks.each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr("href") || "";

        // Only process links to thegreekberkeley.com event pages
        if (
          !href.includes("thegreekberkeley.com/events/") &&
          !href.startsWith("/events/")
        ) {
          return;
        }

        // Deduplicate — each event has multiple links (image + "More Info")
        const eventSlug = href.replace(/.*\/events\//, "").replace(/\/$/, "");
        if (!eventSlug || seen.has(eventSlug)) return;
        seen.add(eventSlug);

        // Find the containing block — walk up to find siblings with date/time info
        const $container = $el.closest(
          "div, article, section, li"
        );

        // Extract title from h2 or h3 within the link or container
        let title =
          $el.find("h2, h3").first().text().trim() ||
          $container.find("h2, h3").first().text().trim() ||
          $el.text().trim();

        if (!title || title === "More Info" || title === "Buy Tickets") {
          // Try sibling links
          title = $container
            .find('a[href*="/events/"] h2, a[href*="/events/"] h3')
            .first()
            .text()
            .trim();
        }
        if (!title) return;

        // Extract image
        const imageUrl =
          $el.find("img").attr("src") ||
          $container.find("img").first().attr("src") ||
          undefined;

        // Get the text content around the event to find date and time
        const containerText = $container.text();

        // Extract date: look for "Day Mon DD" pattern
        const dateMatch = containerText.match(
          /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i
        );
        if (!dateMatch) return;

        const eventDate = parseEventDate(dateMatch[0]);
        if (!eventDate) return;

        // Extract show/doors time
        const showTime = parseShowTime(containerText);
        const startTime = showTime
          ? pacificDate(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate(), showTime.hours, showTime.minutes)
          : pacificDate(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate(), 19, 0);

        // Extract ticket URL
        const ticketUrl =
          $container
            .find('a[href*="ticketmaster.com"]')
            .attr("href") ||
          $container
            .find('a[href*="tickets"]')
            .attr("href") ||
          undefined;

        // Check if sold out
        const isSoldOut = containerText.toLowerCase().includes("sold out");

        // Extract supporting artists from container text
        const subjects: string[] = [];
        subjects.push(title.toLowerCase());

        const eventUrl = href.startsWith("http")
          ? href
          : `https://thegreekberkeley.com/events/${eventSlug}`;

        events.push({
          sourceEventId: eventSlug,
          title,
          startTime,
          isAllDay: false,
          timezone: "America/Los_Angeles",
          location: GREEK_LOCATION,
          address: GREEK_ADDRESS,
          latitude: GREEK_LAT,
          longitude: GREEK_LNG,
          url: eventUrl,
          ticketUrl: ticketUrl || eventUrl,
          imageUrl,
          cost: isSoldOut ? "Sold Out" : undefined,
          isCanceled: false,
          isOnline: false,
          eventType: "concert",
          audience: "public",
          subjects,
          rawData: {
            eventSlug,
            dateText: dateMatch[0],
            timeText: containerText.match(/Doors:.*(?:am|pm)/i)?.[0] || "",
          },
        });
      } catch (err) {
        this.addError(`Failed to parse event: ${err}`);
      }
    });

    return events;
  }
}
