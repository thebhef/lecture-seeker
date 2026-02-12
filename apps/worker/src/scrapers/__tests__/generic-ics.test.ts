import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenericIcsScraper } from "../generic-ics";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-001@example.com
DTSTART:20260601T180000Z
DTEND:20260601T200000Z
SUMMARY:Community Meetup
LOCATION:City Hall\\, Room 200
DESCRIPTION:Monthly community gathering\\nAll welcome
URL:https://example.com/meetup
END:VEVENT
BEGIN:VEVENT
UID:evt-002@example.com
DTSTART:20260615T120000Z
SUMMARY:Lunch Talk
END:VEVENT
END:VCALENDAR`;

const NO_SUMMARY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-no-title@example.com
DTSTART:20260701T100000Z
END:VEVENT
END:VCALENDAR`;

const NO_START_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-no-start@example.com
SUMMARY:Missing Start
END:VEVENT
END:VCALENDAR`;

const EMPTY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;

describe("GenericIcsScraper", () => {
  let scraper: GenericIcsScraper;

  beforeEach(() => {
    scraper = new GenericIcsScraper("my-calendar", "https://example.com/cal.ics");
    vi.restoreAllMocks();
  });

  it("uses the provided slug and url", () => {
    expect(scraper.sourceSlug).toBe("my-calendar");
  });

  it("parses multiple events from an ICS feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("normalizes event fields correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ICS),
      })
    );

    const result = await scraper.scrape();
    const event = result.events[0];

    expect(event.title).toBe("Community Meetup");
    expect(event.location).toBe("City Hall, Room 200");
    expect(event.description).toContain("Monthly community gathering");
    expect(event.description).toContain("\n");
    expect(event.url).toBe("https://example.com/meetup");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.isCanceled).toBe(false);
    expect(event.isOnline).toBe(false);
    expect(event.subjects).toEqual([]);
    expect(event.timezone).toBe("America/Los_Angeles");
  });

  it("parses event without DTEND (node-ical may auto-generate end)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ICS),
      })
    );

    const result = await scraper.scrape();
    const lunchTalk = result.events[1];
    expect(lunchTalk.title).toBe("Lunch Talk");
    // node-ical auto-generates an end time based on DTSTART when DTEND is omitted
    expect(lunchTalk.startTime).toBeInstanceOf(Date);
  });

  it("defaults title to 'Untitled Event' when summary is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(NO_SUMMARY_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Untitled Event");
  });

  it("skips events without a start time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(NO_START_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("returns empty array for ICS with no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("unescapes backslash-commas in location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].location).not.toContain("\\,");
    expect(result.events[0].location).toContain(",");
  });

  it("handles HTTP errors from the ICS feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("DNS resolution failed"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fetches from the URL provided in the constructor", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(EMPTY_ICS),
    });
    vi.stubGlobal("fetch", mockFetch);

    await scraper.scrape();
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/cal.ics");
  });
});
