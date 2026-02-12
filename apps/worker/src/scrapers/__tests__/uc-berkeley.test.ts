import { describe, it, expect, vi, beforeEach } from "vitest";
import { UCBerkeleyScraper } from "../uc-berkeley";

const mockBerkeleyEvent = (overrides = {}) => ({
  id: 99001,
  title: "Lecture | Quantum Computing Frontiers",
  url: "https://events.berkeley.edu/events/quantum",
  description: "A talk about quantum computing",
  summary: "Brief summary",
  date_utc: "2026-04-10T18:00:00Z",
  date2_utc: "2026-04-10T19:30:00Z",
  is_all_day: 0,
  is_canceled: 0,
  is_online: 0,
  cost: "Free",
  timezone: "America/Los_Angeles",
  location: "Wheeler Hall 150",
  ...overrides,
});

function mockFetchSuccess(events: unknown[], totalPages = 1) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        meta: { total_pages: totalPages, page: 1 },
        data: events,
      }),
  });
}

describe("UCBerkeleyScraper", () => {
  let scraper: UCBerkeleyScraper;

  beforeEach(() => {
    scraper = new UCBerkeleyScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("uc-berkeley");
  });

  it("normalizes a complete event correctly", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockBerkeleyEvent()]));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.sourceEventId).toBe("99001");
    expect(event.title).toBe("Quantum Computing Frontiers");
    expect(event.eventType).toBe("lecture");
    expect(event.location).toBe("Wheeler Hall 150");
    expect(event.cost).toBe("Free");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.isAllDay).toBe(false);
    expect(event.isCanceled).toBe(false);
    expect(event.isOnline).toBe(false);
  });

  it("parses pipe-separated title into eventType and title", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ title: "Exhibition | Art of the Ancient World" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].title).toBe("Art of the Ancient World");
    expect(result.events[0].eventType).toBe("exhibition");
  });

  it("preserves title without pipe separator", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ title: "Simple Event Title" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].title).toBe("Simple Event Title");
    expect(result.events[0].eventType).toBeUndefined();
  });

  it("handles all-day events", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ is_all_day: 1 })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].isAllDay).toBe(true);
  });

  it("handles canceled events", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ is_canceled: 1 })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].isCanceled).toBe(true);
  });

  it("handles online events", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ is_online: 1 })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].isOnline).toBe(true);
  });

  it("skips events without a start date", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ date_utc: undefined, date_iso: undefined })])
    );
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("prefers summary over description", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ summary: "Short summary", description: "Long description" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].description).toBe("Short summary");
  });

  it("falls back to date_iso when date_utc is missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ date_utc: undefined, date_iso: "2026-05-01T10:00:00-07:00" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].startTime).toBeInstanceOf(Date);
  });
});
