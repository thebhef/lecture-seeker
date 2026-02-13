import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalAcademyScraper } from "../cal-academy";

/** Extract a Pacific-time component from a Date (works regardless of system TZ). */
const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
function pacificPart(d: Date, type: string): number {
  const v = parseInt(pacific.formatToParts(d).find((p) => p.type === type)!.value);
  return type === "hour" && v === 24 ? 0 : v;
}

function makeDayHtml(events: Array<{ time: string; title: string; href: string; location?: string; description?: string }>) {
  const rows = events
    .map(
      (e) => `
    <div class="events-container">
      <h3>${e.time}</h3>
      <div class="event-title"><a href="${e.href}">${e.title}</a></div>
      <div class="field-content">${e.location || ""}</div>
      <p>${e.description || ""}</p>
    </div>`
    )
    .join("\n");

  return `
<html>
<body>
  <div class="view view-daily-calendar">
    <div class="view-content">
      ${rows}
    </div>
  </div>
</body>
</html>`;
}

const SAMPLE_DAY_HTML = makeDayHtml([
  {
    time: "10:30 a.m.",
    title: "Planetarium Show: Living Worlds",
    href: "/events/planetarium/living-worlds",
    location: "Planetarium",
    description: "Explore the search for life beyond Earth in our state-of-the-art planetarium.",
  },
  {
    time: "11:30 a.m.",
    title: "Earthquake Exhibit Tour",
    href: "/events/tours/earthquake-exhibit",
    location: "Earthquake Gallery",
    description: "Guided tour of the earthquake exhibit.",
  },
  {
    time: "1 p.m.",
    title: "Science Lecture: Ocean Ecosystems",
    href: "/events/lectures/ocean-ecosystems",
    location: "Forum Theater",
    description: "A lecture on the health of our ocean ecosystems.",
  },
  {
    time: "9:30 a.m.",
    title: "Museum Opens",
    href: "/events/museum-hours/museum-opens-1",
    location: "Entrance",
    description: "Cal Academy opens at 9:30 a.m.",
  },
]);

const EMPTY_HTML = `<html><body><div class="view-daily-calendar"><div class="view-content"></div></div></body></html>`;

describe("CalAcademyScraper", () => {
  let scraper: CalAcademyScraper;

  beforeEach(() => {
    scraper = new CalAcademyScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("cal-academy");
  });

  it("parses events from a day page", async () => {
    // Mock fetch to return the sample HTML for every day request
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();

    // Should skip "Museum Opens" entries; 3 real events × 30 days
    // Each day produces 3 events (planetarium, exhibit tour, lecture)
    expect(result.events.length).toBe(3 * 30);
    expect(result.errors).toHaveLength(0);
  });

  it("parses time correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();

    // First event on first day: 10:30 a.m. Pacific
    const planetarium = result.events[0];
    expect(pacificPart(planetarium.startTime, "hour")).toBe(10);
    expect(pacificPart(planetarium.startTime, "minute")).toBe(30);

    // Second event: 11:30 a.m. Pacific
    const exhibit = result.events[1];
    expect(pacificPart(exhibit.startTime, "hour")).toBe(11);
    expect(pacificPart(exhibit.startTime, "minute")).toBe(30);

    // Third event: 1 p.m. Pacific
    const lecture = result.events[2];
    expect(pacificPart(lecture.startTime, "hour")).toBe(13);
    expect(pacificPart(lecture.startTime, "minute")).toBe(0);
  });

  it("filters out museum opens/closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    const titles = result.events.map((e) => e.title);
    expect(titles.every((t) => !t.match(/museum\s+opens?/i))).toBe(true);
  });

  it("infers event types from titles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    const planetarium = result.events.find((e) =>
      e.title.includes("Planetarium")
    );
    expect(planetarium?.eventType).toBe("astronomy");

    const exhibit = result.events.find((e) =>
      e.title.includes("Earthquake Exhibit")
    );
    expect(exhibit?.eventType).toBe("exhibition");

    const lecture = result.events.find((e) =>
      e.title.includes("Science Lecture")
    );
    expect(lecture?.eventType).toBe("lecture");
  });

  it("includes location in the event location field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    const planetarium = result.events[0];
    expect(planetarium.location).toContain("California Academy of Sciences");
    expect(planetarium.location).toContain("Planetarium");
  });

  it("sets fixed venue coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].latitude).toBeCloseTo(37.7699);
    expect(result.events[0].longitude).toBeCloseTo(-122.4661);
    expect(result.events[0].address).toBe(
      "55 Music Concourse Dr, San Francisco, CA 94118"
    );
  });

  it("generates unique source event IDs per day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    const ids = result.events.map((e) => e.sourceEventId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("constructs full URLs for event links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_DAY_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].url).toBe(
      "https://www.calacademy.org/events/planetarium/living-worlds"
    );
  });

  it("returns empty when page has no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(EMPTY_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("handles HTTP errors for individual days gracefully", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        // callCount 1 = initSession, 2-3 = first 2 day pages (fail)
        if (callCount <= 3) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(SAMPLE_DAY_HTML),
        });
      })
    );

    const result = await scraper.scrape();
    // First 2 days fail, remaining 28 days succeed with 3 events each
    expect(result.events.length).toBe(3 * 28);
    expect(result.errors.length).toBe(2);
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
