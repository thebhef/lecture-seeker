import { describe, it, expect, vi, beforeEach } from "vitest";
import { SjsuScraper } from "../sjsu";

const mockEvent = (overrides = {}) => ({
  event: {
    id: 99001,
    title: "SJSU Engineering Seminar",
    description_text: "A talk on robotics",
    description: "<p>A talk on robotics</p>",
    location_name: "Engineering Building",
    room_number: "Room 285",
    address: "1 Washington Sq, San Jose, CA 95192",
    geo: { latitude: "37.3352", longitude: "-121.8811" },
    localist_url: "https://events.sjsu.edu/event/engineering-seminar",
    ticket_url: null,
    ticket_cost: null,
    free: true,
    photo_url: "https://events.sjsu.edu/photo.jpg",
    experience: "inperson",
    status: "live",
    event_instances: [
      {
        event_instance: {
          start: "2026-04-10T18:00:00-07:00",
          end: "2026-04-10T19:30:00-07:00",
          all_day: false,
        },
      },
    ],
    filters: {
      event_types: [{ name: "Lecture" }],
      event_target_audience: [{ name: "General Public" }],
      event_topic: [{ name: "Engineering" }],
    },
    departments: [{ name: "College of Engineering" }],
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

describe("SjsuScraper", () => {
  let scraper: SjsuScraper;

  beforeEach(() => {
    scraper = new SjsuScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("sjsu");
  });

  it("normalizes a complete event correctly", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent()]));

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const event = result.events[0];
    expect(event.sourceEventId).toBe("99001");
    expect(event.title).toBe("SJSU Engineering Seminar");
    expect(event.description).toBe("A talk on robotics");
    expect(event.descriptionHtml).toBe("<p>A talk on robotics</p>");
    expect(event.location).toBe("Engineering Building, Room 285");
    expect(event.address).toBe("1 Washington Sq, San Jose, CA 95192");
    expect(event.latitude).toBeCloseTo(37.3352);
    expect(event.longitude).toBeCloseTo(-121.8811);
    expect(event.url).toBe("https://events.sjsu.edu/event/engineering-seminar");
    expect(event.cost).toBe("Free");
    expect(event.imageUrl).toBe("https://events.sjsu.edu/photo.jpg");
    expect(event.isAllDay).toBe(false);
    expect(event.isCanceled).toBe(false);
    expect(event.isOnline).toBe(false);
    expect(event.eventType).toBe("lecture");
    expect(event.audience).toBe("public");
    expect(event.subjects).toEqual(["Engineering"]);
    expect(event.department).toBe("College of Engineering");
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.startTime).toBeInstanceOf(Date);
    expect(event.endTime).toBeInstanceOf(Date);
  });

  it("marks virtual events as online", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess([mockEvent({ experience: "virtual" })]));
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

  it("normalizes event type aliases", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockEvent({ filters: { event_types: [{ name: "Workshop" }] } }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("workshop");
  });

  it("uses event_target_audience for audience normalization", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        mockEvent({
          filters: {
            event_types: [{ name: "Lecture" }],
            event_target_audience: [{ name: "Student" }],
          },
        }),
      ])
    );
    const result = await scraper.scrape();
    expect(result.events[0].audience).toBe("students");
  });

  it("paginates through multiple pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [mockEvent()],
            page: { current: 1, size: 100, total: 2 },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [mockEvent({ id: 99002, title: "Second Event" })],
            page: { current: 2, size: 100, total: 2 },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
