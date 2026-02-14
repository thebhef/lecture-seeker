import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";
import { pacificDate } from "./timezone";

const BASE_URL = "https://computerhistory.org";
const EVENTS_URL = `${BASE_URL}/events/`;

const CHM_LOCATION = "Computer History Museum";
const CHM_ADDRESS = "1401 N. Shoreline Blvd, Mountain View, CA 94043";
const CHM_LAT = 37.4143;
const CHM_LNG = -122.0777;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses date/time strings like "March 11, 2026 7:00 PM" or "Mar 11, 2026  7:00 pm".
 */
function parseDateTime(text: string): { start: Date; end?: Date } | null {
  // Match "Month Day, Year" with optional time(s)
  const match = text.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}(?::\d{2})?\s*[ap]m)(?:\s*[–\-—]\s*(\d{1,2}(?::\d{2})?\s*[ap]m))?/i
  );
  if (!match) return null;

  const monthStr = match[1].slice(0, 3).toLowerCase();
  const month = MONTHS[monthStr];
  if (month === undefined) return null;

  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const startTime = parseTime(match[4]);
  if (!startTime) return null;

  const start = pacificDate(year, month, day, startTime.hours, startTime.minutes);

  let end: Date | undefined;
  if (match[5]) {
    const endTime = parseTime(match[5]);
    if (endTime) {
      end = pacificDate(year, month, day, endTime.hours, endTime.minutes);
    }
  }

  return { start, end };
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].toLowerCase();

  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

export class ComputerHistoryMuseumScraper extends BaseScraper {
  sourceSlug = SOURCE_SLUGS.COMPUTER_HISTORY_MUSEUM;

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    // Step 1: Fetch the listing page to get event URLs
    const res = await fetch(EVENTS_URL);
    if (!res.ok) {
      this.addError(`Events listing returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Collect unique event links from the listing page
    const eventUrls = new Set<string>();
    $('a[href*="/events/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      // Only match direct event pages, not the listing itself or anchors
      const match = href.match(/\/events\/([a-z0-9-]+)\/?$/i);
      if (match) {
        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        eventUrls.add(fullUrl);
      }
    });

    // Step 2: Fetch each event detail page
    const events: NormalizedEvent[] = [];
    for (const url of eventUrls) {
      try {
        const event = await this.scrapeDetailPage(url);
        if (event) events.push(event);
      } catch (err) {
        this.addError(`Failed to scrape ${url}: ${err}`);
      }
    }

    return events;
  }

  private async scrapeDetailPage(url: string): Promise<NormalizedEvent | null> {
    const res = await fetch(url);
    if (!res.ok) {
      this.addError(`Event page ${url} returned ${res.status}`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract slug for sourceEventId
    const slug = url.replace(/\/$/, "").split("/").pop() || "";
    if (!slug) return null;

    // Title: h1 or og:title
    const title =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.replace(/ - CHM$/, "").trim() ||
      "";
    if (!title) return null;

    // Date/time: look for text matching date patterns in the page
    const dateTimeText = this.extractDateTimeText($);
    const parsed = dateTimeText ? parseDateTime(dateTimeText) : null;
    if (!parsed) {
      this.addError(`Could not parse date/time for ${slug}`);
      return null;
    }

    // Description: gather paragraphs from the main content
    const description = this.extractDescription($);

    // Image: og:image or first content image
    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      undefined;

    // Ticket URL: Eventbrite widget
    const ticketUrl = this.extractTicketUrl($);

    // Infer event type from title
    const eventType = this.inferEventType(title, description);

    return {
      sourceEventId: slug,
      title,
      description,
      startTime: parsed.start,
      endTime: parsed.end,
      isAllDay: false,
      timezone: "America/Los_Angeles",
      location: CHM_LOCATION,
      address: CHM_ADDRESS,
      latitude: CHM_LAT,
      longitude: CHM_LNG,
      url,
      ticketUrl,
      imageUrl,
      isCanceled: false,
      isOnline: false,
      eventType,
      audience: "public",
      subjects: [],
      rawData: { slug, dateTimeText, url },
    };
  }

  private extractDateTimeText($: cheerio.CheerioAPI): string | null {
    // Look for common date patterns in the page text
    // CHM pages have date/time in various containers
    const pageText = $("body").text();
    const match = pageText.match(
      /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}\s+\d{1,2}(?::\d{2})?\s*[ap]m(?:\s*[–\-—]\s*\d{1,2}(?::\d{2})?\s*[ap]m)?)/i
    );
    return match ? match[1] : null;
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    // Try og:description first
    const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();
    if (ogDesc) return ogDesc;

    // Gather first few paragraphs from content
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      if (paragraphs.length >= 3) return;
      const text = $(el).text().trim();
      if (text.length > 30) paragraphs.push(text);
    });
    return paragraphs.join(" ") || undefined;
  }

  private extractTicketUrl($: cheerio.CheerioAPI): string | undefined {
    // Look for Eventbrite widget script
    const scriptText = $("script").text();
    const ebMatch = scriptText.match(/eventId['":\s]+['"]?(\d{10,})['"]?/);
    if (ebMatch) {
      return `https://www.eventbrite.com/e/${ebMatch[1]}`;
    }
    // Look for direct ticket links
    const ticketLink = $('a[href*="eventbrite.com"], a[href*="ticket"]').first().attr("href");
    return ticketLink || undefined;
  }

  private inferEventType(title: string, description?: string): string | undefined {
    const text = `${title} ${description || ""}`.toLowerCase();
    const direct = normalizeEventType(title);
    if (direct) return direct;

    if (text.includes("exhibit")) return "exhibition";
    if (text.includes("film") || text.includes("screening")) return "film";
    if (text.includes("workshop") || text.includes("hands-on")) return "workshop";
    if (text.includes("concert") || text.includes("music")) return "concert";
    // Most CHM events are talks/lectures
    return "lecture";
  }
}
