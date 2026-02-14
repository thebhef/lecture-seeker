import { describe, it, expect, vi, beforeEach } from "vitest";
import { GreekTheatreScraper } from "../greek-theatre";

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
<div class="events-list">
  <div class="event-card">
    <a href="https://thegreekberkeley.com/events/royel-otis-260416">
      <img src="https://thegreekberkeley.com/wp-content/uploads/2025/12/RoyelOtis-353x192.png" alt="Royel Otis">
      <h3>Royel Otis</h3>
    </a>
    <div>Thu Apr 16</div>
    <div>Greek Theatre</div>
    <div>Berkeley, CA</div>
    <div>Doors: 5:30 pm Show: 7:00 pm</div>
    <a href="https://www.ticketmaster.com/royel-otis-berkeley-04-16-2026/event/1C006389A5AD90C2">Buy Tickets</a>
    <a href="https://thegreekberkeley.com/events/royel-otis-260416">More Info</a>
  </div>

  <div class="event-card">
    <a href="https://thegreekberkeley.com/events/lewis-capaldi-260503">
      <img src="https://thegreekberkeley.com/wp-content/uploads/2026/01/LewisCapaldi-353x192.jpg" alt="Lewis Capaldi">
      <h3>Lewis Capaldi</h3>
    </a>
    <div>Sun May 03</div>
    <div>Greek Theatre</div>
    <div>Berkeley, CA</div>
    <div>Doors: 6:00 pm Show: 7:30 pm</div>
    <a href="https://www.ticketmaster.com/lewis-capaldi-berkeley-05-03-2026/event/ABC123">Buy Tickets</a>
    <a href="https://thegreekberkeley.com/events/lewis-capaldi-260503">More Info</a>
  </div>

  <div class="event-card">
    <a href="https://thegreekberkeley.com/events/sold-out-show-260610">
      <img src="https://thegreekberkeley.com/wp-content/uploads/2026/02/SoldOut-353x192.jpg" alt="Sold Out Show">
      <h3>Sold Out Show</h3>
    </a>
    <div>Wed Jun 10</div>
    <div>Greek Theatre</div>
    <div>Berkeley, CA</div>
    <div>Doors: 6:30 pm Show: 8:00 pm</div>
    <div>Sold Out!</div>
    <a href="https://thegreekberkeley.com/events/sold-out-show-260610">More Info</a>
  </div>
</div>
</body>
</html>`;

const EMPTY_HTML = `<html><body><p>No events scheduled</p></body></html>`;

describe("GreekTheatreScraper", () => {
  let scraper: GreekTheatreScraper;

  beforeEach(() => {
    scraper = new GreekTheatreScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("greek-theatre");
  });

  it("parses events from calendar page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();

    expect(result.events.length).toBe(3);
    expect(result.errors).toHaveLength(0);

    const first = result.events[0];
    expect(first.title).toBe("Royel Otis");
    expect(first.location).toBe("Greek Theatre");
    expect(first.address).toBe("2001 Gayley Road, Berkeley, CA 94720");
    expect(first.eventType).toBe("concert");
    expect(first.isOnline).toBe(false);
    expect(first.isCanceled).toBe(false);
    expect(first.audience).toBe("public");
    expect(first.url).toBe(
      "https://thegreekberkeley.com/events/royel-otis-260416"
    );
  });

  it("extracts show time correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();

    // Royel Otis: Show: 7:00 pm Pacific
    const first = result.events[0];
    expect(pacificPart(first.startTime, "hour")).toBe(19);
    expect(pacificPart(first.startTime, "minute")).toBe(0);

    // Lewis Capaldi: Show: 7:30 pm Pacific
    const second = result.events[1];
    expect(pacificPart(second.startTime, "hour")).toBe(19);
    expect(pacificPart(second.startTime, "minute")).toBe(30);
  });

  it("extracts dates correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();

    // Thu Apr 16 Pacific
    expect(pacificPart(result.events[0].startTime, "month")).toBe(4); // April (1-based)
    expect(pacificPart(result.events[0].startTime, "day")).toBe(16);

    // Sun May 03 Pacific
    expect(pacificPart(result.events[1].startTime, "month")).toBe(5); // May (1-based)
    expect(pacificPart(result.events[1].startTime, "day")).toBe(3);
  });

  it("extracts ticket URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].ticketUrl).toContain("ticketmaster.com");
    expect(result.events[1].ticketUrl).toContain("ticketmaster.com");
  });

  it("extracts image URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].imageUrl).toContain("RoyelOtis");
    expect(result.events[1].imageUrl).toContain("LewisCapaldi");
  });

  it("detects sold out events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    const soldOut = result.events[2];
    expect(soldOut.title).toBe("Sold Out Show");
    expect(soldOut.cost).toBe("Sold Out");
  });

  it("deduplicates events with multiple links", async () => {
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

  it("returns empty for page with no events", async () => {
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
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
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

  it("sets fixed venue coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].latitude).toBeCloseTo(37.8741);
    expect(result.events[0].longitude).toBeCloseTo(-122.2538);
  });
});
