import { describe, it, expect, vi, beforeEach } from "vitest";
import { SanMateoLibraryScraper } from "../san-mateo-library";

function mockApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    events: {
      items: ["evt-001", "evt-002"],
      pagination: { count: 2, pages: 1, page: 1, limit: 50 },
    },
    entities: {
      events: {
        "evt-001": {
          id: "evt-001",
          key: "2026-04-15T17:00:00",
          seriesId: "series-1",
          definition: {
            start: "2026-04-15T17:00:00-07:00",
            end: "2026-04-15T18:30:00-07:00",
            title: "Storytime for Families",
            description: "<p>Join us for a fun storytime session.</p>",
            branchLocationId: "loc-1",
            audienceIds: ["aud-1"],
            typeIds: ["type-1"],
            isCancelled: false,
          },
          isRecurring: false,
        },
        "evt-002": {
          id: "evt-002",
          key: "2026-04-20T18:00:00",
          seriesId: "series-2",
          definition: {
            start: "2026-04-20T18:00:00-07:00",
            end: "2026-04-20T19:00:00-07:00",
            title: "Author Talk: New Novel",
            description: "<p>Meet the author of this exciting <b>new</b> novel.</p>",
            branchLocationId: "loc-2",
            audienceIds: ["aud-2"],
            typeIds: ["type-2"],
            isCancelled: false,
          },
          isRecurring: false,
        },
      },
      eventAudiences: {
        "aud-1": { id: "aud-1", name: "Children" },
        "aud-2": { id: "aud-2", name: "Adults" },
      },
      eventTypes: {
        "type-1": { id: "type-1", name: "Storytime" },
        "type-2": { id: "type-2", name: "Author Talk" },
      },
      locations: {
        "loc-1": {
          id: "loc-1",
          name: "Half Moon Bay Library",
          address: {
            line1: "620 Correas St",
            city: "Half Moon Bay",
            region: "CA",
            postalCode: "94019",
          },
          latitude: 37.4636,
          longitude: -122.4286,
        },
        "loc-2": {
          id: "loc-2",
          name: "San Mateo Main Library",
          address: {
            line1: "55 W 3rd Ave",
            city: "San Mateo",
            region: "CA",
            postalCode: "94402",
          },
          latitude: 37.5630,
          longitude: -122.3255,
        },
      },
    },
    ...overrides,
  };
}

function mockFetchSuccess(response: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(response),
  });
}

describe("SanMateoLibraryScraper", () => {
  let scraper: SanMateoLibraryScraper;

  beforeEach(() => {
    scraper = new SanMateoLibraryScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("san-mateo-library");
  });

  it("normalizes events correctly", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess(mockApiResponse()));

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts all fields from a storytime event", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess(mockApiResponse()));

    const result = await scraper.scrape();
    const event = result.events[0];

    expect(event.sourceEventId).toBe("evt-001");
    expect(event.title).toBe("Storytime for Families");
    expect(event.description).toBe("Join us for a fun storytime session.");
    expect(event.descriptionHtml).toBe("<p>Join us for a fun storytime session.</p>");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.location).toBe("Half Moon Bay Library");
    expect(event.address).toBe("620 Correas St, Half Moon Bay, CA");
    expect(event.latitude).toBeCloseTo(37.4636);
    expect(event.longitude).toBeCloseTo(-122.4286);
    expect(event.url).toBe("https://smcl.bibliocommons.com/events/evt-001");
    expect(event.isCanceled).toBe(false);
  });

  it("resolves event types from entities", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess(mockApiResponse()));

    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("performance");  // storytime → performance
    expect(result.events[1].eventType).toBe("lecture");       // author talk → lecture
  });

  it("resolves audience from entities", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess(mockApiResponse()));

    const result = await scraper.scrape();
    expect(result.events[0].audience).toBe("public");   // children → public
    expect(result.events[1].audience).toBe("public");   // adults → public
  });

  it("strips HTML from descriptions", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess(mockApiResponse()));

    const result = await scraper.scrape();
    expect(result.events[1].description).toBe("Meet the author of this exciting new novel.");
  });

  it("handles cancelled events", async () => {
    const response = mockApiResponse();
    (response.entities.events["evt-001"] as any).definition.isCancelled = true;
    vi.stubGlobal("fetch", mockFetchSuccess(response));

    const result = await scraper.scrape();
    expect(result.events[0].isCanceled).toBe(true);
  });

  it("handles missing location gracefully", async () => {
    const response = mockApiResponse();
    (response.entities.events["evt-001"] as any).definition.branchLocationId = undefined;
    vi.stubGlobal("fetch", mockFetchSuccess(response));

    const result = await scraper.scrape();
    expect(result.events[0].location).toBeUndefined();
    expect(result.events[0].address).toBeUndefined();
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

  it("handles network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Network error"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("paginates through multiple pages", async () => {
    const page1 = {
      events: {
        items: ["evt-001"],
        pagination: { count: 2, pages: 2, page: 1, limit: 50 },
      },
      entities: {
        events: {
          "evt-001": mockApiResponse().entities.events["evt-001"],
        },
        eventAudiences: mockApiResponse().entities.eventAudiences,
        eventTypes: mockApiResponse().entities.eventTypes,
        locations: mockApiResponse().entities.locations,
      },
    };

    const page2 = {
      events: {
        items: ["evt-002"],
        pagination: { count: 2, pages: 2, page: 2, limit: 50 },
      },
      entities: {
        events: {
          "evt-002": mockApiResponse().entities.events["evt-002"],
        },
        eventAudiences: mockApiResponse().entities.eventAudiences,
        eventTypes: mockApiResponse().entities.eventTypes,
        locations: mockApiResponse().entities.locations,
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles events with no type or audience entities", async () => {
    const response = mockApiResponse();
    response.entities.eventTypes = {} as any;
    response.entities.eventAudiences = {} as any;
    vi.stubGlobal("fetch", mockFetchSuccess(response));

    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBeUndefined();
    expect(result.events[0].audience).toBeUndefined();
  });
});
