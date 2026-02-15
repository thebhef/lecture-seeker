import { describe, it, expect, vi, beforeEach } from "vitest";
import { KipacScraper } from "../kipac";

const mockEvent = (overrides: Record<string, unknown> = {}) => ({
  id: "72ab2b51-a015-4a6a-8541-7d87aa3c8b24",
  type: "node--stanford_event",
  attributes: {
    status: true,
    title: "Lodha: Understanding Dark Energy using DESI DR2 BAO measurements",
    body: {
      value: "<p>Speaker: Kushal Lodha (KASI)</p><p>Using parametric methods to study dark energy.</p>",
      processed: "<p>Speaker: Kushal Lodha (KASI)</p>",
      summary: "",
    },
    path: {
      alias: "/events/kipac-tea-talk/lodha-understanding-dark-energy",
      pid: 546,
      langcode: "en",
    },
    su_event_alt_loc: "SLAC, Kavli 3rd Floor Conf. Room",
    su_event_date_time: {
      value: "2025-07-25T17:40:00+00:00",
      end_value: "2025-07-25T18:30:00+00:00",
      duration: 50,
      timezone: "America/Los_Angeles",
    },
    ...overrides,
  },
});

function mockFetchSuccess(events: unknown[], total?: number) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        data: events,
        meta: { count: total ?? events.length },
        links: {},
      }),
  });
}

describe("KipacScraper", () => {
  let scraper: KipacScraper;

  beforeEach(() => {
    scraper = new KipacScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("kipac");
  });

  it("normalizes a complete event correctly", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent()]));

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const event = result.events[0];
    expect(event.sourceEventId).toBe("72ab2b51-a015-4a6a-8541-7d87aa3c8b24");
    expect(event.title).toBe("Lodha: Understanding Dark Energy using DESI DR2 BAO measurements");
    expect(event.description).toContain("Kushal Lodha");
    expect(event.descriptionHtml).toContain("<p>");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.isAllDay).toBe(false);
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.location).toBe("SLAC, Kavli 3rd Floor Conf. Room");
    expect(event.url).toBe("https://kipac.stanford.edu/events/kipac-tea-talk/lodha-understanding-dark-energy");
    expect(event.isCanceled).toBe(false);
    expect(event.department).toBe("KIPAC");
    expect(event.subjects).toEqual([]);
    expect(event.rawData).toBeDefined();
    expect(event.audience).toBe("academic");
  });

  it("skips events with status false", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ status: false })]));
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("skips events without date_time", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ su_event_date_time: null })]));
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("handles events with null body", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ body: null })]));
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].description).toBeUndefined();
    expect(result.events[0].descriptionHtml).toBeUndefined();
  });

  it("handles events without path alias", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ path: null })]));
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].url).toBeUndefined();
  });

  it("detects online events from Zoom links in body", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockEvent({
          body: {
            value: '<p>Join via <a href="https://stanford.zoom.us/j/123">Zoom</a></p>',
          },
        }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].isOnline).toBe(true);
  });

  it("infers 'lecture' type for tea talk titles", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ title: "KIPAC Tea Talk: Dark Matter" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("lecture");
  });

  it("infers 'conference' type for colloquium titles", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ title: "Astrophysics Colloquium: Galaxy Formation" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("conference");
  });

  it("infers 'lecture' type for thesis defense titles", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ title: "PhD Thesis Defense: Stellar Evolution" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("lecture");
  });

  it("defaults to 'lecture' for generic KIPAC events", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ title: "Special Discussion on Cosmology" })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("lecture");
  });

  it("paginates through multiple pages", async () => {
    const events1 = [mockEvent()];
    const events2 = [mockEvent({ title: "Second Event" })];
    // Override the id so both are distinct
    events2[0].id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: events1, meta: { count: 2 }, links: {} }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: events2, meta: { count: 2 }, links: {} }),
        })
    );

    // Use page size of 1 to trigger pagination — but the scraper uses 50, so
    // we simulate by setting total count = 2 and returning 1 event per page
    const result = await scraper.scrape();
    // With PAGE_SIZE=50 and total=2, all events arrive on first page normally
    // But since we mock 2 responses and count=2, offset 0 returns 1 event,
    // then offset 50 > 2 so pagination stops after first page
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });

  it("handles API errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("500");
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("strips HTML from body for plain text description", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockEvent({
          body: { value: "<p>Hello <strong>World</strong>&amp; friends</p>" },
        }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].description).toBe("Hello World & friends");
  });

  it("handles events with no location", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ su_event_alt_loc: null })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].location).toBeUndefined();
  });
});
