import { describe, it, expect } from "vitest";
import { toCalendarEvents, SOURCE_COLORS } from "../calendar-utils";
import type { EventWithSource } from "../types";
import type { Event, Source } from "@prisma/client";

function makeEvent(overrides: Partial<Event> & { source?: Partial<Pick<Source, "name" | "slug">> } = {}): EventWithSource {
  const { source: sourceOverride, ...eventOverrides } = overrides;
  return {
    id: "evt-001",
    sourceId: "src-001",
    sourceEventId: "ext-001",
    title: "Test Event",
    description: "A test event",
    descriptionHtml: null,
    startTime: new Date("2026-06-15T14:00:00Z"),
    endTime: new Date("2026-06-15T16:00:00Z"),
    isAllDay: false,
    timezone: "America/Los_Angeles",
    location: "Room 101",
    address: "123 Main St",
    latitude: 37.7749,
    longitude: -122.4194,
    url: "https://example.com/event/1",
    ticketUrl: null,
    imageUrl: null,
    cost: "Free",
    isCanceled: false,
    isOnline: false,
    eventType: "lecture",
    audience: null,
    subjects: [],
    department: null,
    rawData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: { name: "Stanford Events", slug: "stanford", ...sourceOverride },
    ...eventOverrides,
  } as EventWithSource;
}

describe("toCalendarEvents", () => {
  const now = new Date("2026-06-15T15:00:00Z");

  it("maps basic event fields correctly", () => {
    const events = [makeEvent()];
    const result = toCalendarEvents(events, now);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("evt-001");
    expect(result[0].title).toBe("Test Event");
    expect(result[0].start).toEqual(new Date("2026-06-15T14:00:00Z"));
    expect(result[0].end).toEqual(new Date("2026-06-15T16:00:00Z"));
    expect(result[0].allDay).toBe(false);
  });

  it("sets allDay from event.isAllDay", () => {
    const result = toCalendarEvents([makeEvent({ isAllDay: true })], now);
    expect(result[0].allDay).toBe(true);
  });

  it("assigns stanford color for stanford source", () => {
    const result = toCalendarEvents(
      [makeEvent({ source: { name: "Stanford", slug: "stanford" } })],
      now
    );
    expect(result[0].backgroundColor).toBe(SOURCE_COLORS.stanford);
    expect(result[0].borderColor).toBe(SOURCE_COLORS.stanford);
  });

  it("assigns uc-berkeley color", () => {
    const result = toCalendarEvents(
      [makeEvent({ source: { name: "UC Berkeley", slug: "uc-berkeley" } })],
      now
    );
    expect(result[0].backgroundColor).toBe(SOURCE_COLORS["uc-berkeley"]);
  });

  it("assigns cal-bears color", () => {
    const result = toCalendarEvents(
      [makeEvent({ source: { name: "Cal Bears", slug: "cal-bears" } })],
      now
    );
    expect(result[0].backgroundColor).toBe(SOURCE_COLORS["cal-bears"]);
  });

  it("assigns csm-observatory color", () => {
    const result = toCalendarEvents(
      [makeEvent({ source: { name: "CSM", slug: "csm-observatory" } })],
      now
    );
    expect(result[0].backgroundColor).toBe(SOURCE_COLORS["csm-observatory"]);
  });

  it("uses default gray color for unknown source slugs", () => {
    const result = toCalendarEvents(
      [makeEvent({ source: { name: "Custom", slug: "my-custom-source" } })],
      now
    );
    expect(result[0].backgroundColor).toBe("#6b7280");
    expect(result[0].borderColor).toBe("#6b7280");
  });

  it("marks past events with fc-event-past class (end time < now)", () => {
    const pastEvent = makeEvent({
      startTime: new Date("2026-06-14T10:00:00Z"),
      endTime: new Date("2026-06-14T12:00:00Z"),
    });
    const result = toCalendarEvents([pastEvent], now);
    expect(result[0].classNames).toEqual(["fc-event-past"]);
  });

  it("does not mark future events as past", () => {
    const futureEvent = makeEvent({
      startTime: new Date("2026-06-16T10:00:00Z"),
      endTime: new Date("2026-06-16T12:00:00Z"),
    });
    const result = toCalendarEvents([futureEvent], now);
    expect(result[0].classNames).toEqual([]);
  });

  it("uses startTime for past check when endTime is null", () => {
    const pastNoEnd = makeEvent({
      startTime: new Date("2026-06-14T10:00:00Z"),
      endTime: null,
    });
    const result = toCalendarEvents([pastNoEnd], now);
    expect(result[0].classNames).toEqual(["fc-event-past"]);
    expect(result[0].end).toBeUndefined();
  });

  it("does not mark event as past when endTime is still in the future", () => {
    // Event started in the past but hasn't ended yet
    const ongoingEvent = makeEvent({
      startTime: new Date("2026-06-15T13:00:00Z"),
      endTime: new Date("2026-06-15T17:00:00Z"),
    });
    const result = toCalendarEvents([ongoingEvent], now);
    expect(result[0].classNames).toEqual([]);
  });

  it("preserves the original event in extendedProps", () => {
    const event = makeEvent();
    const result = toCalendarEvents([event], now);
    expect(result[0].extendedProps.event).toBe(event);
  });

  it("handles multiple events", () => {
    const events = [
      makeEvent({ id: "a", title: "First" }),
      makeEvent({ id: "b", title: "Second" }),
      makeEvent({ id: "c", title: "Third" }),
    ];
    const result = toCalendarEvents(events, now);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty input", () => {
    const result = toCalendarEvents([], now);
    expect(result).toEqual([]);
  });
});
