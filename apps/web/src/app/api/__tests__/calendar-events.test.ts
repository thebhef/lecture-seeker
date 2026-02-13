import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { toCalendarEvents, SOURCE_COLORS } from "@/lib/calendar-utils";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    event: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as listEvents } from "../events/route";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function makeApiEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-001",
    sourceId: "src-001",
    sourceEventId: "ext-001",
    title: "Intro to Astrophysics",
    description: "A fascinating lecture on stars",
    descriptionHtml: null,
    startTime: new Date("2026-06-15T18:00:00Z"),
    endTime: new Date("2026-06-15T20:00:00Z"),
    isAllDay: false,
    timezone: "America/Los_Angeles",
    location: "Hewlett Teaching Center",
    address: "370 Jane Stanford Way",
    latitude: 37.4275,
    longitude: -122.1697,
    url: "https://events.stanford.edu/event/12345",
    ticketUrl: null,
    imageUrl: null,
    cost: "Free",
    isCanceled: false,
    isOnline: false,
    eventType: "lecture",
    audience: null,
    subjects: ["Physics"],
    department: "Department of Physics",
    rawData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: { name: "Stanford Events", slug: "stanford" },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration: GET /api/events → toCalendarEvents
// ─────────────────────────────────────────────────────────────────────────────
describe("Events API → Calendar rendering pipeline", () => {
  const now = new Date("2026-06-15T17:00:00Z");

  beforeEach(() => vi.clearAllMocks());

  it("API response events are correctly transformed into calendar entries", async () => {
    const apiEvents = [
      makeApiEvent(),
      makeApiEvent({
        id: "evt-002",
        title: "Cal Bears vs Oregon",
        startTime: new Date("2026-06-16T00:00:00Z"),
        endTime: new Date("2026-06-16T23:59:59Z"),
        isAllDay: true,
        eventType: "sports",
        source: { name: "Cal Bears Athletics", slug: "cal-bears" },
      }),
    ];
    mockPrisma.event.findMany.mockResolvedValue(apiEvents);
    mockPrisma.event.count.mockResolvedValue(2);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();

    // Feed API response directly into calendar utility
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toHaveLength(2);

    // First event: Stanford lecture
    expect(calEvents[0].id).toBe("evt-001");
    expect(calEvents[0].title).toBe("Intro to Astrophysics");
    expect(calEvents[0].allDay).toBe(false);
    expect(calEvents[0].backgroundColor).toBe(SOURCE_COLORS.stanford);
    expect(calEvents[0].extendedProps.event.location).toBe("Hewlett Teaching Center");

    // Second event: Cal Bears all-day game
    expect(calEvents[1].id).toBe("evt-002");
    expect(calEvents[1].title).toBe("Cal Bears vs Oregon");
    expect(calEvents[1].allDay).toBe(true);
    expect(calEvents[1].backgroundColor).toBe(SOURCE_COLORS["cal-bears"]);
  });

  it("past events from the API are marked with fc-event-past class on the calendar", async () => {
    const pastEvent = makeApiEvent({
      id: "evt-past",
      startTime: new Date("2026-06-14T10:00:00Z"),
      endTime: new Date("2026-06-14T12:00:00Z"),
    });
    const futureEvent = makeApiEvent({
      id: "evt-future",
      startTime: new Date("2026-06-16T10:00:00Z"),
      endTime: new Date("2026-06-16T12:00:00Z"),
    });
    mockPrisma.event.findMany.mockResolvedValue([pastEvent, futureEvent]);
    mockPrisma.event.count.mockResolvedValue(2);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents[0].classNames).toEqual(["fc-event-past"]);
    expect(calEvents[1].classNames).toEqual([]);
  });

  it("each source's events get the correct color on the calendar", async () => {
    const events = [
      makeApiEvent({
        id: "evt-stanford",
        source: { name: "Stanford Events", slug: "stanford" },
      }),
      makeApiEvent({
        id: "evt-berkeley",
        source: { name: "UC Berkeley Events", slug: "uc-berkeley" },
      }),
      makeApiEvent({
        id: "evt-bears",
        source: { name: "Cal Bears Athletics", slug: "cal-bears" },
      }),
      makeApiEvent({
        id: "evt-csm",
        source: { name: "CSM Observatory", slug: "csm-observatory" },
      }),
      makeApiEvent({
        id: "evt-custom",
        source: { name: "My Custom Feed", slug: "my-custom-feed" },
      }),
    ];
    mockPrisma.event.findMany.mockResolvedValue(events);
    mockPrisma.event.count.mockResolvedValue(5);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents[0].backgroundColor).toBe("#8C1515"); // Stanford cardinal
    expect(calEvents[1].backgroundColor).toBe("#003262"); // Berkeley blue
    expect(calEvents[2].backgroundColor).toBe("#FDB515"); // Cal gold
    expect(calEvents[3].backgroundColor).toBe("#2563eb"); // CSM blue
    expect(calEvents[4].backgroundColor).toBe("#6b7280"); // Default gray
  });

  it("calendar view fetches with higher limit and events render correctly", async () => {
    // Calendar mode uses limit=200 (the schema maximum)
    const manyEvents = Array.from({ length: 5 }, (_, i) =>
      makeApiEvent({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startTime: new Date(`2026-06-${15 + i}T18:00:00Z`),
        endTime: new Date(`2026-06-${15 + i}T20:00:00Z`),
      })
    );
    mockPrisma.event.findMany.mockResolvedValue(manyEvents);
    mockPrisma.event.count.mockResolvedValue(5);

    const res = await listEvents(makeRequest("/api/events?limit=200"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(json.pagination.limit).toBe(200);
    expect(calEvents).toHaveLength(5);
    calEvents.forEach((calEvt, i) => {
      expect(calEvt.id).toBe(`evt-${i}`);
      expect(calEvt.title).toBe(`Event ${i}`);
      expect(calEvt.start).toBeDefined();
    });
  });

  it("filtered events by source appear correctly on the calendar", async () => {
    const stanfordEvents = [
      makeApiEvent({ id: "evt-s1", title: "Stanford Lecture 1" }),
      makeApiEvent({ id: "evt-s2", title: "Stanford Lecture 2" }),
    ];
    mockPrisma.event.findMany.mockResolvedValue(stanfordEvents);
    mockPrisma.event.count.mockResolvedValue(2);

    const res = await listEvents(makeRequest("/api/events?source=stanford"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    // Verify source filter was applied
    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: { slug: "stanford" } }),
      })
    );

    // All calendar events should be Stanford-colored
    calEvents.forEach((e) => {
      expect(e.backgroundColor).toBe(SOURCE_COLORS.stanford);
    });
  });

  it("events without endTime produce calendar entries with undefined end", async () => {
    const noEndEvent = makeApiEvent({
      id: "evt-noend",
      endTime: null,
    });
    mockPrisma.event.findMany.mockResolvedValue([noEndEvent]);
    mockPrisma.event.count.mockResolvedValue(1);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents[0].end).toBeUndefined();
    expect(calEvents[0].start).toBeDefined();
  });

  it("canceled events from API still appear on the calendar", async () => {
    const canceledEvent = makeApiEvent({
      id: "evt-canceled",
      title: "Canceled: Physics Seminar",
      isCanceled: true,
    });
    mockPrisma.event.findMany.mockResolvedValue([canceledEvent]);
    mockPrisma.event.count.mockResolvedValue(1);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toHaveLength(1);
    expect(calEvents[0].title).toBe("Canceled: Physics Seminar");
    expect(calEvents[0].extendedProps.event.isCanceled).toBe(true);
  });

  it("online events from API render on the calendar with source-based color", async () => {
    const onlineEvent = makeApiEvent({
      id: "evt-online",
      title: "Virtual Workshop",
      isOnline: true,
      location: null,
      source: { name: "UC Berkeley Events", slug: "uc-berkeley" },
    });
    mockPrisma.event.findMany.mockResolvedValue([onlineEvent]);
    mockPrisma.event.count.mockResolvedValue(1);

    const res = await listEvents(makeRequest("/api/events?isOnline=true"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toHaveLength(1);
    expect(calEvents[0].backgroundColor).toBe(SOURCE_COLORS["uc-berkeley"]);
    expect(calEvents[0].extendedProps.event.isOnline).toBe(true);
  });

  it("search-filtered events render on the calendar", async () => {
    const matchedEvent = makeApiEvent({
      id: "evt-match",
      title: "Jazz Under the Stars",
    });
    mockPrisma.event.findMany.mockResolvedValue([matchedEvent]);
    mockPrisma.event.count.mockResolvedValue(1);

    const res = await listEvents(makeRequest("/api/events?q=jazz"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toHaveLength(1);
    expect(calEvents[0].title).toBe("Jazz Under the Stars");
  });

  it("date-range filtered events for a month populate the calendar", async () => {
    const junEvents = [
      makeApiEvent({
        id: "evt-jun1",
        startTime: new Date("2026-06-01T10:00:00Z"),
        endTime: new Date("2026-06-01T12:00:00Z"),
      }),
      makeApiEvent({
        id: "evt-jun15",
        startTime: new Date("2026-06-15T18:00:00Z"),
        endTime: new Date("2026-06-15T20:00:00Z"),
      }),
      makeApiEvent({
        id: "evt-jun30",
        startTime: new Date("2026-06-30T18:00:00Z"),
        endTime: new Date("2026-06-30T20:00:00Z"),
      }),
    ];
    mockPrisma.event.findMany.mockResolvedValue(junEvents);
    mockPrisma.event.count.mockResolvedValue(3);

    const res = await listEvents(
      makeRequest(
        "/api/events?startAfter=2026-06-01T00:00:00Z&startBefore=2026-06-30T23:59:59Z"
      )
    );
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toHaveLength(3);
    // Events spanning early June are past, late June is future
    expect(calEvents[0].classNames).toEqual(["fc-event-past"]);
    expect(calEvents[1].classNames).toEqual([]);
    expect(calEvents[2].classNames).toEqual([]);
  });

  it("empty API response produces an empty calendar", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();
    const calEvents = toCalendarEvents(json.data, now);

    expect(calEvents).toEqual([]);
  });
});
