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

  it("normalizes 'Exhibit' alias to 'exhibition'", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockBerkeleyEvent({ title: "Exhibit | Modern Sculpture" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].title).toBe("Modern Sculpture");
    expect(result.events[0].eventType).toBe("exhibition");
  });

  it("keeps full title when pipe prefix is not a recognized category", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ title: "Berkeley Graduate Conference | Keynote Address" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].title).toBe("Berkeley Graduate Conference | Keynote Address");
    expect(result.events[0].eventType).toBeUndefined();
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

  it("handles API errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("500");
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Network error"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("uses date2_iso as end time fallback when date2_utc is missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ date2_utc: undefined, date2_iso: "2026-04-10T21:00:00-07:00" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].endTime).toBeInstanceOf(Date);
  });

  it("leaves endTime undefined when both date2_utc and date2_iso are missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ date2_utc: undefined, date2_iso: undefined }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].endTime).toBeUndefined();
  });

  it("falls back to description when summary is empty", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ summary: "", description: "Detailed description here" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].description).toBe("Detailed description here");
  });

  it("leaves description undefined when both summary and description are missing", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ summary: undefined, description: undefined }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].description).toBeUndefined();
  });

  it("uses event timezone when provided", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ timezone: "America/New_York" }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].timezone).toBe("America/New_York");
  });

  it("defaults timezone to America/Los_Angeles when not provided", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockBerkeleyEvent({ timezone: undefined }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].timezone).toBe("America/Los_Angeles");
  });
});
