import { BaseScraper } from "./base";
import type { NormalizedEvent } from "@lecture-seeker/shared";
import { SOURCE_SLUGS, normalizeEventType } from "@lecture-seeker/shared";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { pacificDate } from "./timezone";

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
  private cookies = "";

  async fetchAndParse(): Promise<NormalizedEvent[]> {
    const allEvents: NormalizedEvent[] = [];
    const today = new Date();

    // Pre-fetch the main calendar page to obtain session cookies
    await this.initSession();

    let consecutiveFailures = 0;

    // Scrape each day's calendar page
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatDate(date);

      try {
        const dayEvents = await this.scrapeDayPage(date, dateStr);
        allEvents.push(...dayEvents);
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        this.addError(`Failed to scrape ${dateStr}: ${err}`);
        // Abort early if every request is failing (likely blocked)
        if (consecutiveFailures >= 5) {
          this.addError(
            "Aborting: 5 consecutive failures — the site may be blocking automated requests. " +
            "Check if the Cal Academy website structure or anti-bot protections have changed."
          );
          break;
        }
      }
    }

    return allEvents;
  }

  /**
   * Fetches the main calendar page to acquire any session cookies
   * that downstream day-page requests may need.
   */
  private async initSession(): Promise<void> {
    try {
      const res = await fetch(`${BASE_URL}/daily-calendar`, {
        headers: this.buildHeaders(BASE_URL),
        redirect: "follow",
      });
      // Extract Set-Cookie headers for subsequent requests
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        this.cookies = setCookie
          .split(",")
          .map((c) => c.split(";")[0].trim())
          .join("; ");
      }
    } catch {
      // Non-fatal — we still attempt day pages without cookies
    }
  }

  private buildHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    };
    if (referer) headers["Referer"] = referer;
    if (this.cookies) headers["Cookie"] = this.cookies;
    return headers;
  }

  private async scrapeDayPage(
    date: Date,
    dateStr: string
  ): Promise<NormalizedEvent[]> {
    const url = `${BASE_URL}${CALENDAR_PATH}/${dateStr}`;
    const res = await fetch(url, {
      headers: this.buildHeaders(`${BASE_URL}/daily-calendar`),
      redirect: "follow",
    });
    if (!res.ok) {
      this.addError(
        `Calendar page ${dateStr} returned ${res.status}` +
        (res.status === 403 ? " (access denied — site may be blocking scrapers)" : "")
      );
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

    // The Cal Academy daily calendar uses .events-container divs with .event-title
    // elements inside each block. Fall back to finding event links directly.
    const $rows = $(".events-container");

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

        // Find the event title — use .event-title or fall back to event links
        const $titleEl = $row.find(".event-title a, a[href*='/events/']").first();
        if (!$titleEl.length) return;

        const href = $titleEl.attr("href") || "";
        const eventPath = href.replace(/^https?:\/\/[^/]+/, "");

        // Deduplicate by path + date
        const eventKey = `${eventPath}::${dateStr}`;
        if (seen.has(eventKey)) return;
        seen.add(eventKey);

        const title = $titleEl.text().trim();
        if (!title) return;

        // Skip generic museum operations entries
        if (/^museum\s+(opens?|closes?)/i.test(title)) return;

        // Extract time — look for time-like text anywhere in the container
        const timeText =
          $row.find("h3, .event-time, time").first().text().trim() ||
          $row.text().match(/\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/i)?.[0] ||
          "";

        let startTime: Date;
        const parsedTime = parseTime(timeText);
        if (parsedTime) {
          startTime = pacificDate(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            parsedTime.hours,
            parsedTime.minutes
          );
        } else {
          // Default to 10am for events without a specific time
          startTime = pacificDate(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            10,
            0
          );
        }

        // Extract location/room
        const location =
          $row.find(".field-content, .location").first().text().trim() ||
          undefined;

        // Extract description
        const description =
          $row.find("p, .description").first().text().trim() ||
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
          audience: "public",
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
    _$: cheerio.CheerioAPI,
    $link: cheerio.Cheerio<AnyNode>,
    date: Date,
    dateStr: string
  ): NormalizedEvent | null {
    const href = $link.attr("href") || "";
    const title = $link.text().trim();
    if (!title || /^museum\s+(opens?|closes?)/i.test(title)) return null;

    const eventPath = href.replace(/^https?:\/\/[^/]+/, "");
    const sourceEventId = `${eventPath.replace(/^\/events\//, "").replace(/\//g, "-")}::${dateStr}`;
    const eventUrl = href.startsWith("http") ? href : `${BASE_URL}${eventPath}`;

    const startTime = pacificDate(
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
      audience: "public",
      subjects: [],
      rawData: { dateStr, href },
    };
  }
}
