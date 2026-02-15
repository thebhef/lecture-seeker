import { describe, it, expect, vi, beforeEach } from "vitest";
import { CSMObservatoryScraper } from "../csm-observatory";

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

const OBSERVATORY_HTML = `
<html>
<body>
  <h3>Spring 2026 Schedule</h3>
  <table>
    <tr><th>Date</th><th>Time</th></tr>
    <tr><td>Jan 24</td><td>7:00-9:00PM</td></tr>
    <tr><td>Feb 21</td><td>Time TBD</td></tr>
    <tr><td>Mar 21</td><td>8:00-10:00PM</td></tr>
    <tr><td>Apr 25</td><td>8:30-10:30PM</td></tr>
  </table>
</body>
</html>`;

const PLANETARIUM_HTML = `
<html>
<body>
  <h2>Spring 2026 Schedule</h2>
  <table>
    <tr><td>Date</td><td>Title</td></tr>
    <tr><td>No Show in February</td><td>Holiday (Lincoln's Birthday)</td></tr>
    <tr><td>March 13</td><td>TBD</td></tr>
    <tr><td>April 10</td><td>Journey to the Stars</td></tr>
    <tr><td>May 15</td><td>TBD</td></tr>
  </table>

  <h2>Spring 2026 Schedule</h2>
  <table>
    <tr><td>Date</td><td>Speaker</td></tr>
    <tr><td>February 6</td><td>Dr Sofia Sheikh, SETI Research Scientist: Searching for Technological Life in the Universe</td></tr>
    <tr><td>March 6</td><td>TBD</td></tr>
    <tr><td>No talk in April</td><td>Spring Break</td></tr>
    <tr><td>May 1</td><td>Dr Brian Lantz, Stanford, Exploring the Gravitational Wave Universe</td></tr>
  </table>
</body>
</html>`;

const EMPTY_HTML = `<html><body><p>No schedule available</p></body></html>`;

/** Mock fetch to return different HTML based on the URL. */
function mockFetch(
  observatoryHtml: string | null,
  planetariumHtml: string | null
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("observatory.asp")) {
        if (observatoryHtml === null)
          return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(observatoryHtml),
        });
      }
      if (url.includes("planetarium.asp")) {
        if (planetariumHtml === null)
          return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(planetariumHtml),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    })
  );
}

describe("CSMObservatoryScraper", () => {
  let scraper: CSMObservatoryScraper;

  beforeEach(() => {
    scraper = new CSMObservatoryScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("csm-observatory");
  });

  // ── Observatory (Jazz Under the Stars) ────────────────────────────

  it("parses observatory schedule table correctly", async () => {
    mockFetch(OBSERVATORY_HTML, EMPTY_HTML);

    const result = await scraper.scrape();

    // Should skip "Time TBD" row, so 3 observatory events
    const jazzEvents = result.events.filter((e) =>
      e.sourceEventId.startsWith("csm-jazz-")
    );
    expect(jazzEvents).toHaveLength(3);

    const jan = jazzEvents[0];
    expect(jan.title).toBe("Jazz Under the Stars");
    expect(jan.eventType).toBe("astronomy");
    expect(jan.cost).toBe("Free");
    expect(jan.location).toContain("College of San Mateo Observatory");
    expect(jan.address).toBe("1700 W Hillsdale Blvd, San Mateo, CA 94402");
    expect(jan.latitude).toBeCloseTo(37.5385);
    expect(jan.longitude).toBeCloseTo(-122.4651);
    expect(jan.subjects).toEqual(["astronomy", "jazz", "stargazing"]);
    expect(jan.isOnline).toBe(false);
    expect(jan.isCanceled).toBe(false);
    expect(jan.audience).toBe("public");
  });

  it("parses observatory time ranges correctly", async () => {
    mockFetch(OBSERVATORY_HTML, EMPTY_HTML);

    const result = await scraper.scrape();
    const jazzEvents = result.events.filter((e) =>
      e.sourceEventId.startsWith("csm-jazz-")
    );

    // Jan 24, 7:00-9:00PM Pacific
    const jan = jazzEvents[0];
    expect(pacificPart(jan.startTime, "month") - 1).toBe(0);
    expect(pacificPart(jan.startTime, "day")).toBe(24);
    expect(pacificPart(jan.startTime, "hour")).toBe(19);
    expect(pacificPart(jan.endTime!, "hour")).toBe(21);

    // Mar 21, 8:00-10:00PM Pacific
    const mar = jazzEvents[1];
    expect(pacificPart(mar.startTime, "month") - 1).toBe(2);
    expect(pacificPart(mar.startTime, "hour")).toBe(20);
    expect(pacificPart(mar.endTime!, "hour")).toBe(22);

    // Apr 25, 8:30-10:30PM Pacific
    const apr = jazzEvents[2];
    expect(pacificPart(apr.startTime, "minute")).toBe(30);
    expect(pacificPart(apr.endTime!, "minute")).toBe(30);
  });

  it("skips TBD time entries in observatory table", async () => {
    mockFetch(OBSERVATORY_HTML, EMPTY_HTML);

    const result = await scraper.scrape();
    const ids = result.events.map((e) => e.sourceEventId);
    expect(ids.every((id) => !id.includes("02-21"))).toBe(true);
  });

  // ── Planetarium (The Sky Tonight) ─────────────────────────────────

  it("parses planetarium show schedule", async () => {
    mockFetch(EMPTY_HTML, PLANETARIUM_HTML);

    const result = await scraper.scrape();
    const shows = result.events.filter((e) =>
      e.sourceEventId.startsWith("csm-planetarium-")
    );

    // "No Show in February" is skipped, 3 shows remain
    expect(shows).toHaveLength(3);

    // March 13 — title is TBD
    expect(shows[0].title).toBe("The Sky Tonight");
    expect(shows[0].eventType).toBe("astronomy");
    expect(shows[0].location).toContain("Planetarium");
    expect(pacificPart(shows[0].startTime, "month") - 1).toBe(2);
    expect(pacificPart(shows[0].startTime, "day")).toBe(13);
    expect(pacificPart(shows[0].startTime, "hour")).toBe(19);
    expect(pacificPart(shows[0].endTime!, "hour")).toBe(21);

    // April 10 — has a specific title
    expect(shows[1].title).toBe("The Sky Tonight: Journey to the Stars");
    expect(pacificPart(shows[1].startTime, "month") - 1).toBe(3);

    // May 15 — TBD title
    expect(shows[2].title).toBe("The Sky Tonight");
  });

  it("planetarium events are free and public", async () => {
    mockFetch(EMPTY_HTML, PLANETARIUM_HTML);

    const result = await scraper.scrape();
    const shows = result.events.filter((e) =>
      e.sourceEventId.startsWith("csm-planetarium-")
    );

    for (const show of shows) {
      expect(show.cost).toBe("Free");
      expect(show.audience).toBe("public");
      expect(show.isOnline).toBe(false);
      expect(show.isCanceled).toBe(false);
      expect(show.subjects).toContain("planetarium");
    }
  });

  // ── SMCAS (Monthly Meeting & Guest Speaker) ───────────────────────

  it("parses SMCAS speaker schedule", async () => {
    mockFetch(EMPTY_HTML, PLANETARIUM_HTML);

    const result = await scraper.scrape();
    const talks = result.events.filter((e) =>
      e.sourceEventId.startsWith("csm-smcas-")
    );

    // "No talk in April" is skipped, 3 talks remain
    expect(talks).toHaveLength(3);

    // February 6 — named speaker
    expect(talks[0].title).toContain("SMCAS:");
    expect(talks[0].title).toContain("Dr Sofia Sheikh");
    expect(talks[0].eventType).toBe("lecture");
    expect(talks[0].location).toContain("Planetarium");
    expect(pacificPart(talks[0].startTime, "month") - 1).toBe(1);
    expect(pacificPart(talks[0].startTime, "day")).toBe(6);
    expect(pacificPart(talks[0].startTime, "hour")).toBe(19);
    expect(pacificPart(talks[0].endTime!, "hour")).toBe(21);

    // March 6 — TBD speaker
    expect(talks[1].title).toBe("SMCAS Monthly Meeting");

    // May 1 — named speaker
    expect(talks[2].title).toContain("Dr Brian Lantz");
  });

  // ── Combined scraping ─────────────────────────────────────────────

  it("scrapes both observatory and planetarium pages", async () => {
    mockFetch(OBSERVATORY_HTML, PLANETARIUM_HTML);

    const result = await scraper.scrape();

    const jazz = result.events.filter((e) => e.sourceEventId.startsWith("csm-jazz-"));
    const shows = result.events.filter((e) => e.sourceEventId.startsWith("csm-planetarium-"));
    const talks = result.events.filter((e) => e.sourceEventId.startsWith("csm-smcas-"));

    expect(jazz).toHaveLength(3);
    expect(shows).toHaveLength(3);
    expect(talks).toHaveLength(3);
    expect(result.events).toHaveLength(9);
  });

  it("generates unique source event IDs across all event types", async () => {
    mockFetch(OBSERVATORY_HTML, PLANETARIUM_HTML);

    const result = await scraper.scrape();
    const ids = result.events.map((e) => e.sourceEventId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // ── Error handling ────────────────────────────────────────────────

  it("returns empty for pages with no table", async () => {
    mockFetch(EMPTY_HTML, EMPTY_HTML);

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("observatory failure does not break planetarium scraping", async () => {
    mockFetch(null, PLANETARIUM_HTML);

    const result = await scraper.scrape();

    // Planetarium events still scraped
    const shows = result.events.filter((e) => e.sourceEventId.startsWith("csm-planetarium-"));
    const talks = result.events.filter((e) => e.sourceEventId.startsWith("csm-smcas-"));
    expect(shows.length).toBeGreaterThan(0);
    expect(talks.length).toBeGreaterThan(0);

    // Error recorded for observatory
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("planetarium failure does not break observatory scraping", async () => {
    mockFetch(OBSERVATORY_HTML, null);

    const result = await scraper.scrape();

    // Observatory events still scraped
    const jazz = result.events.filter((e) => e.sourceEventId.startsWith("csm-jazz-"));
    expect(jazz.length).toBeGreaterThan(0);

    // Error recorded for planetarium
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles both pages failing gracefully", async () => {
    mockFetch(null, null);

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
