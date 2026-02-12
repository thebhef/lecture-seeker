import { describe, it, expect, vi, beforeEach } from "vitest";
import { StanfordScraper } from "../stanford";

const mockEvent = (overrides = {}) => ({
  event: {
    id: 12345,
    title: "Test Lecture on AI",
    description_text: "A description in plain text",
    description: "<p>A description in HTML</p>",
    location_name: "Gates Building",
    room_number: "Room 104",
    address: "353 Jane Stanford Way, Stanford, CA",
    geo: { latitude: "37.4300", longitude: "-122.1700" },
    localist_url: "https://events.stanford.edu/event/test-lecture",
    ticket_url: "https://tickets.stanford.edu/test",
    ticket_cost: "$10",
    free: false,
    photo_url: "https://img.stanford.edu/photo.jpg",
    experience: "inperson",
    status: "live",
    event_instances: [
      {
        event_instance: {
          start: "2026-03-15T14:00:00-07:00",
          end: "2026-03-15T15:30:00-07:00",
          all_day: false,
        },
      },
    ],
    filters: {
      event_types: [{ name: "Lecture" }],
      event_audience: [{ name: "General Public" }],
      event_subject: [{ name: "Computer Science" }, { name: "AI" }],
    },
    departments: [{ name: "CS Department" }],
    ...overrides,
  },
});

function mockFetchSuccess(events: unknown[], totalPages = 1) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        events,
        page: { current: 1, size: 100, total: totalPages },
      }),
  });
}

describe("StanfordScraper", () => {
  let scraper: StanfordScraper;

  beforeEach(() => {
    scraper = new StanfordScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("stanford");
  });

  it("normalizes a complete event correctly", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent()]));

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const event = result.events[0];
    expect(event.sourceEventId).toBe("12345");
    expect(event.title).toBe("Test Lecture on AI");
    expect(event.description).toBe("A description in plain text");
    expect(event.descriptionHtml).toBe("<p>A description in HTML</p>");
    expect(event.location).toBe("Gates Building, Room 104");
    expect(event.address).toBe("353 Jane Stanford Way, Stanford, CA");
    expect(event.latitude).toBeCloseTo(37.43);
    expect(event.longitude).toBeCloseTo(-122.17);
    expect(event.url).toBe("https://events.stanford.edu/event/test-lecture");
    expect(event.ticketUrl).toBe("https://tickets.stanford.edu/test");
    expect(event.cost).toBe("$10");
    expect(event.imageUrl).toBe("https://img.stanford.edu/photo.jpg");
    expect(event.isAllDay).toBe(false);
    expect(event.isCanceled).toBe(false);
    expect(event.isOnline).toBe(false);
    expect(event.eventType).toBe("lecture");
    expect(event.audience).toBe("General Public");
    expect(event.subjects).toEqual(["Computer Science", "AI"]);
    expect(event.department).toBe("CS Department");
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
  });

  it("sets cost to 'Free' when event.free is true", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ free: true, ticket_cost: "" })]));

    const result = await scraper.scrape();
    expect(result.events[0].cost).toBe("Free");
  });

  it("marks virtual events as online", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ experience: "virtual" })]));
    const result = await scraper.scrape();
    expect(result.events[0].isOnline).toBe(true);
  });

  it("marks hybrid events as online", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ experience: "hybrid" })]));
    const result = await scraper.scrape();
    expect(result.events[0].isOnline).toBe(true);
  });

  it("marks canceled events", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ status: "canceled" })]));
    const result = await scraper.scrape();
    expect(result.events[0].isCanceled).toBe(true);
  });

  it("skips events without event_instances", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ event_instances: [] })]));
    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
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

  it("handles location with only location_name (no room)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([mockEvent({ location_name: "Cantor Center", room_number: undefined })])
    );
    const result = await scraper.scrape();
    expect(result.events[0].location).toBe("Cantor Center");
  });
});
