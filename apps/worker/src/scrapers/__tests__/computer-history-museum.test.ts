import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComputerHistoryMuseumScraper } from "../computer-history-museum";

/** Helper: creates a minimal events listing page with links */
function makeListingHtml(eventSlugs: string[]): string {
  const links = eventSlugs
    .map((slug) => `<a href="https://computerhistory.org/events/${slug}/">${slug}</a>`)
    .join("\n");
  return `<html><body>${links}</body></html>`;
}

/** Helper: creates a realistic event detail page */
function makeDetailHtml(overrides: {
  title?: string;
  dateTime?: string;
  description?: string;
  imageUrl?: string;
  eventbriteId?: string;
} = {}): string {
  const {
    title = "Apple at 50",
    dateTime = "March 11, 2026 7:00 pm",
    description = "Join us for a special evening celebrating Apple's 50th anniversary.",
    imageUrl = "https://computerhistory.org/wp-content/uploads/2026/02/apple_924x551.jpg",
    eventbriteId = "1981601493410",
  } = overrides;

  return `<html>
<head>
  <meta property="og:title" content="${title} - CHM">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:description" content="${description}">
</head>
<body>
  <h1>${title}</h1>
  <div class="event-date-time">${dateTime}</div>
  <p>${description}</p>
  <h5>Location</h5>
  <p>CHM<br/>1401 N. Shoreline Blvd<br/>Mountain View, CA, 94043</p>
  ${eventbriteId ? `<script>window.EBWidgets.createWidget({ widgetType: 'checkout', eventId: '${eventbriteId}' });</script>` : ""}
</body>
</html>`;
}

/** Helper to extract Pacific time parts for timezone-aware assertions */
function pacificPart(date: Date, type: "year" | "month" | "day" | "hour" | "minute"): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const v = parseInt(parts.find((p) => p.type === type)!.value);
  return type === "hour" && v === 24 ? 0 : v;
}

describe("ComputerHistoryMuseumScraper", () => {
  let scraper: ComputerHistoryMuseumScraper;

  beforeEach(() => {
    scraper = new ComputerHistoryMuseumScraper();
    vi.restoreAllMocks();
  });

  it("has the correct source slug", () => {
    expect(scraper.sourceSlug).toBe("computer-history-museum");
  });

  it("scrapes a listing page and fetches detail pages", async () => {
    const listingHtml = makeListingHtml(["apple-at-50"]);
    const detailHtml = makeDetailHtml();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) }) // listing
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) }) // detail
    );

    const result = await scraper.scrape();

    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const event = result.events[0];
    expect(event.sourceEventId).toBe("apple-at-50");
    expect(event.title).toBe("Apple at 50");
    expect(event.location).toBe("Computer History Museum");
    expect(event.address).toBe("1401 N. Shoreline Blvd, Mountain View, CA 94043");
    expect(event.latitude).toBeCloseTo(37.4143);
    expect(event.longitude).toBeCloseTo(-122.0777);
    expect(event.timezone).toBe("America/Los_Angeles");
    expect(event.isCanceled).toBe(false);
    expect(event.isOnline).toBe(false);
    expect(event.subjects).toEqual([]);
    expect(event.rawData).toBeDefined();
    expect(event.audience).toBe("public");
  });

  it("parses date and time correctly", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ dateTime: "March 11, 2026 7:00 pm" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    const event = result.events[0];

    expect(pacificPart(event.startTime, "year")).toBe(2026);
    expect(pacificPart(event.startTime, "month")).toBe(3);
    expect(pacificPart(event.startTime, "day")).toBe(11);
    expect(pacificPart(event.startTime, "hour")).toBe(19);
    expect(pacificPart(event.startTime, "minute")).toBe(0);
  });

  it("parses date/time with end time", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ dateTime: "April 5, 2026 6:30 pm – 8:00 pm" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    const event = result.events[0];

    expect(pacificPart(event.startTime, "hour")).toBe(18);
    expect(pacificPart(event.startTime, "minute")).toBe(30);
    expect(event.endTime).toBeDefined();
    expect(pacificPart(event.endTime!, "hour")).toBe(20);
    expect(pacificPart(event.endTime!, "minute")).toBe(0);
  });

  it("extracts image from og:image meta tag", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ imageUrl: "https://computerhistory.org/img/test.jpg" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].imageUrl).toBe("https://computerhistory.org/img/test.jpg");
  });

  it("extracts Eventbrite ticket URL", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ eventbriteId: "9876543210123" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].ticketUrl).toBe("https://www.eventbrite.com/e/9876543210123");
  });

  it("infers 'exhibition' event type from title", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ title: "New Exhibit: Early Computing" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("exhibition");
  });

  it("infers 'film' event type from title", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ title: "Film Screening: Silicon Valley Documentary" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("film");
  });

  it("defaults to 'lecture' event type for generic CHM events", async () => {
    const listingHtml = makeListingHtml(["test-event"]);
    const detailHtml = makeDetailHtml({ title: "Apple at 50" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].eventType).toBe("lecture");
  });

  it("deduplicates event links from listing page", async () => {
    // Same slug appears twice in listing
    const html = `<html><body>
      <a href="/events/apple-at-50/">Apple at 50</a>
      <a href="/events/apple-at-50/">Apple at 50 again</a>
      <a href="https://computerhistory.org/events/apple-at-50/">Apple at 50 full url</a>
    </body></html>`;
    const detailHtml = makeDetailHtml();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(html) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
  });

  it("handles listing page errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("500");
  });

  it("handles detail page errors gracefully", async () => {
    const listingHtml = makeListingHtml(["working-event", "broken-event"]);
    const detailHtml = makeDetailHtml();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) }) // first detail succeeds
        .mockResolvedValueOnce({ ok: false, status: 404 }) // second detail fails
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("404");
  });

  it("handles network failures gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles empty listing page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html><body><p>No events</p></body></html>"),
      })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("skips detail pages where date cannot be parsed", async () => {
    const listingHtml = makeListingHtml(["no-date-event"]);
    const detailHtml = `<html>
<head><meta property="og:title" content="No Date Event - CHM"></head>
<body><h1>No Date Event</h1><p>This event has no date information.</p></body>
</html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("date/time");
  });

  it("constructs correct event URL", async () => {
    const listingHtml = makeListingHtml(["my-cool-event"]);
    const detailHtml = makeDetailHtml();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(listingHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(detailHtml) })
    );

    const result = await scraper.scrape();
    expect(result.events[0].url).toBe("https://computerhistory.org/events/my-cool-event/");
  });
});
