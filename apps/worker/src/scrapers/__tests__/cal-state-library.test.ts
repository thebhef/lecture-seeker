import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalStateLibraryScraper } from "../cal-state-library";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LibCal//EN
X-WR-CALNAME:California State Library
X-WR-TIMEZONE:America/Los_Angeles
BEGIN:VEVENT
UID:libcal-event-1@libraryca.libcal.com
DTSTART:20260415T180000Z
DTEND:20260415T193000Z
SUMMARY:CRB Nexus: Artificial Intelligence Part 1
DESCRIPTION:Join us for a briefing on AI policy in California.
LOCATION:California State Library\\, Sacramento
URL:https://libraryca.libcal.com/event/12345
CATEGORIES:History,Law
END:VEVENT
BEGIN:VEVENT
UID:libcal-event-2@libraryca.libcal.com
DTSTART:20260420T170000Z
DTEND:20260420T183000Z
SUMMARY:Hands-on Workshop: Digital Archives
DESCRIPTION:A hands-on workshop for library staff.
LOCATION:Virtual via Zoom
URL:https://libraryca.libcal.com/event/12346
END:VEVENT
BEGIN:VEVENT
UID:libcal-event-3@libraryca.libcal.com
DTSTART:20260501T190000Z
DTEND:20260501T203000Z
SUMMARY:Film Screening: California Stories
DESCRIPTION:Watch a screening of documentary films about California history.
LOCATION:California State Library\\, San Francisco
URL:https://libraryca.libcal.com/event/12347
END:VEVENT
BEGIN:VEVENT
UID:libcal-event-4@libraryca.libcal.com
DTSTART:20260510T180000Z
SUMMARY:Book Club: California History Reads
DESCRIPTION:Join our monthly social book club discussion.
URL:https://libraryca.libcal.com/event/12348
END:VEVENT
END:VCALENDAR`;

function mockFetchIcs(icsText: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(icsText),
  });
}

describe("CalStateLibraryScraper", () => {
  let scraper: CalStateLibraryScraper;

  beforeEach(() => {
    scraper = new CalStateLibraryScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("cal-state-library");
  });

  it("parses ICS events correctly", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts event fields from VEVENT", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[0];

    expect(event.sourceEventId).toBe("libcal-event-1@libraryca.libcal.com");
    expect(event.title).toBe("CRB Nexus: Artificial Intelligence Part 1");
    expect(event.description).toContain("briefing on AI policy");
    expect(event.location).toBe("California State Library, Sacramento");
    expect(event.url).toBe("https://libraryca.libcal.com/event/12345");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.isCanceled).toBe(false);
  });

  it("infers lecture event type from briefing keyword", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[0];
    expect(event.eventType).toBe("lecture");
  });

  it("infers workshop event type from hands-on keyword", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[1];
    expect(event.eventType).toBe("workshop");
  });

  it("infers film event type from screening keyword", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[2];
    expect(event.eventType).toBe("film");
  });

  it("infers social event type from book club keyword", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[3];
    expect(event.eventType).toBe("social");
  });

  it("detects virtual/online events", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    // Event 2 has "Virtual via Zoom" location
    expect(result.events[1].isOnline).toBe(true);
    expect(result.events[1].location).toBeUndefined();
    // Event 1 is in-person
    expect(result.events[0].isOnline).toBe(false);
  });

  it("handles ICS feed errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Network error"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles empty ICS feed", async () => {
    const emptyIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LibCal//EN
END:VCALENDAR`;

    vi.stubGlobal("fetch", mockFetchIcs(emptyIcs));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts categories as subjects", async () => {
    vi.stubGlobal("fetch", mockFetchIcs(SAMPLE_ICS));

    const result = await scraper.scrape();
    const event = result.events[0];
    expect(event.subjects).toEqual(["History", "Law"]);
  });
});
