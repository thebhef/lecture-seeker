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

const SAMPLE_HTML = `
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

const EMPTY_HTML = `<html><body><p>No schedule available</p></body></html>`;

describe("CSMObservatoryScraper", () => {
  let scraper: CSMObservatoryScraper;

  beforeEach(() => {
    scraper = new CSMObservatoryScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("csm-observatory");
  });

  it("parses schedule table correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();

    // Should skip "Time TBD" row, so 3 events
    expect(result.events).toHaveLength(3);

    const jan = result.events[0];
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
    expect(jan.sourceEventId).toMatch(/^csm-jazz-/);
    expect(jan.audience).toBe("public");
  });

  it("parses time ranges correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    const currentYear = new Date().getFullYear();

    // Jan 24, 7:00-9:00PM Pacific
    const jan = result.events[0];
    expect(pacificPart(jan.startTime, "month") - 1).toBe(0); // January (Intl month is 1-based)
    expect(pacificPart(jan.startTime, "day")).toBe(24);
    expect(pacificPart(jan.startTime, "hour")).toBe(19); // 7PM
    expect(pacificPart(jan.endTime!, "hour")).toBe(21); // 9PM

    // Mar 21, 8:00-10:00PM Pacific
    const mar = result.events[1];
    expect(pacificPart(mar.startTime, "month") - 1).toBe(2); // March
    expect(pacificPart(mar.startTime, "hour")).toBe(20); // 8PM
    expect(pacificPart(mar.endTime!, "hour")).toBe(22); // 10PM

    // Apr 25, 8:30-10:30PM Pacific
    const apr = result.events[2];
    expect(pacificPart(apr.startTime, "minute")).toBe(30);
    expect(pacificPart(apr.endTime!, "minute")).toBe(30);
  });

  it("skips TBD time entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    const titles = result.events.map((e) => e.sourceEventId);
    // Feb 21 has "Time TBD", should be skipped
    expect(titles.every((id) => !id.includes("02-21"))).toBe(true);
  });

  it("returns empty for page with no table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("handles HTTP errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("generates unique source event IDs per date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    const ids = result.events.map((e) => e.sourceEventId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
