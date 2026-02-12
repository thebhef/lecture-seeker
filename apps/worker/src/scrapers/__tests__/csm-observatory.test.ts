import { describe, it, expect, vi, beforeEach } from "vitest";
import { CSMObservatoryScraper } from "../csm-observatory";

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

    // Jan 24, 7:00-9:00PM
    const jan = result.events[0];
    expect(jan.startTime.getMonth()).toBe(0); // January
    expect(jan.startTime.getDate()).toBe(24);
    expect(jan.startTime.getHours()).toBe(19); // 7PM
    expect(jan.endTime!.getHours()).toBe(21); // 9PM

    // Mar 21, 8:00-10:00PM
    const mar = result.events[1];
    expect(mar.startTime.getMonth()).toBe(2); // March
    expect(mar.startTime.getHours()).toBe(20); // 8PM
    expect(mar.endTime!.getHours()).toBe(22); // 10PM

    // Apr 25, 8:30-10:30PM
    const apr = result.events[2];
    expect(apr.startTime.getMinutes()).toBe(30);
    expect(apr.endTime!.getMinutes()).toBe(30);
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

  it("handles network failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("skips rows with malformed date text", async () => {
    const htmlWithBadDate = `
    <html><body>
      <table>
        <tr><th>Date</th><th>Time</th></tr>
        <tr><td>Not A Date</td><td>7:00-9:00PM</td></tr>
        <tr><td>Jan 24</td><td>7:00-9:00PM</td></tr>
      </table>
    </body></html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithBadDate),
      })
    );

    const result = await scraper.scrape();
    // Only the valid "Jan 24" row should produce an event
    expect(result.events).toHaveLength(1);
  });

  it("skips rows with malformed time text", async () => {
    const htmlWithBadTime = `
    <html><body>
      <table>
        <tr><th>Date</th><th>Time</th></tr>
        <tr><td>Jan 24</td><td>not-a-time</td></tr>
      </table>
    </body></html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithBadTime),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("always sets fixed metadata fields for all events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    for (const event of result.events) {
      expect(event.title).toBe("Jazz Under the Stars");
      expect(event.eventType).toBe("astronomy");
      expect(event.cost).toBe("Free");
      expect(event.isOnline).toBe(false);
      expect(event.isCanceled).toBe(false);
      expect(event.timezone).toBe("America/Los_Angeles");
      expect(event.subjects).toEqual(["astronomy", "jazz", "stargazing"]);
      expect(event.url).toBe("https://collegeofsanmateo.edu/astronomy/observatory.asp");
    }
  });
});
