import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalBearsScraper } from "../cal-bears";

const MINIMAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:game-001@calbears.com
DTSTART:20260315T190000Z
DTEND:20260315T220000Z
SUMMARY:California Men's Basketball vs Stanford
LOCATION:Haas Pavilion\\, Berkeley\\, Calif.
DESCRIPTION:Big game rivalry\\nLive on ESPN
URL:https://calbears.com/game/123
END:VEVENT
BEGIN:VEVENT
UID:game-002@calbears.com
DTSTART:20260320T010000Z
DTEND:20260320T040000Z
SUMMARY:California Baseball vs UCLA
LOCATION:Evans Diamond\\, Berkeley
END:VEVENT
END:VCALENDAR`;

const EMPTY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;

describe("CalBearsScraper", () => {
  let scraper: CalBearsScraper;

  beforeEach(() => {
    scraper = new CalBearsScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("cal-bears");
  });

  it("parses ICS events correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    const basketball = result.events[0];
    expect(basketball.title).toBe("California Men's Basketball vs Stanford");
    expect(basketball.location).toBe("Haas Pavilion, Berkeley, Calif.");
    expect(basketball.eventType).toBe("sports");
    expect(basketball.subjects).toContain("Men's Basketball");
    expect(basketball.startTime).toBeInstanceOf(Date);
    expect(basketball.endTime).toBeInstanceOf(Date);
    expect(basketball.url).toBe("https://calbears.com/game/123");
    expect(basketball.description).toContain("Big game rivalry");
    expect(basketball.description).toContain("\n");

    const baseball = result.events[1];
    expect(baseball.title).toBe("California Baseball vs UCLA");
    expect(baseball.subjects).toContain("Baseball");
  });

  it("unescapes commas in location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].location).not.toContain("\\,");
    expect(result.events[0].location).toContain(",");
  });

  it("returns empty array for ICS with no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_ICS),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
  });

  it("handles HTTP errors from ICS feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it.each([
    ["California Women's Basketball vs Oregon", "Women's Basketball"],
    ["California Softball at Arizona", "Softball"],
    ["California Swimming & Diving Invitational", "Swimming"],
    ["California Men's Soccer vs San Jose State", "Men's Soccer"],
    ["California Track & Field at Pac-12 Championships", "Track & Field"],
  ])("extracts sport from '%s'", async (summary, expected) => {
    const s = new CalBearsScraper();
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test@test\r\nDTSTART:20260401T190000Z\r\nSUMMARY:${summary}\r\nEND:VEVENT\r\nEND:VCALENDAR`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(ics),
      })
    );

    const result = await s.scrape();
    expect(result.events[0].subjects).toContain(expected);
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Connection refused"))
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns empty subjects when sport is not recognized", async () => {
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test@test\r\nDTSTART:20260401T190000Z\r\nSUMMARY:California Quidditch Exhibition\r\nEND:VEVENT\r\nEND:VCALENDAR`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(ics),
      })
    );

    const result = await scraper.scrape();
    expect(result.events[0].subjects).toEqual([]);
  });

  it("always sets eventType to 'sports'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_ICS),
      })
    );

    const result = await scraper.scrape();
    for (const event of result.events) {
      expect(event.eventType).toBe("sports");
    }
  });

  it("unescapes \\n in descriptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_ICS),
      })
    );

    const result = await scraper.scrape();
    const basketball = result.events[0];
    // The description should have real newlines, not escaped \\n
    expect(basketball.description).not.toContain("\\n");
    expect(basketball.description).toContain("\n");
  });
});
