import { describe, it, expect } from "vitest";
import { generateIcs } from "../ics-generator";
import type { Event } from "@prisma/client";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-001",
    sourceId: "src-001",
    sourceEventId: "ext-001",
    title: "Test Event",
    description: "A test event description",
    descriptionHtml: null,
    startTime: new Date("2026-06-15T14:00:00Z"),
    endTime: new Date("2026-06-15T16:00:00Z"),
    isAllDay: false,
    timezone: "America/Los_Angeles",
    location: "Room 101, Main Building",
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
    ...overrides,
  };
}

describe("generateIcs", () => {
  it("generates valid ICS content with VCALENDAR wrapper", () => {
    const ics = generateIcs(makeEvent());
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes the event title as SUMMARY", () => {
    const ics = generateIcs(makeEvent({ title: "My Special Lecture" }));
    expect(ics).toContain("My Special Lecture");
  });

  it("includes the location", () => {
    const ics = generateIcs(makeEvent({ location: "Doe Library" }));
    expect(ics).toContain("Doe Library");
  });

  it("includes the description", () => {
    const ics = generateIcs(makeEvent({ description: "Learn about stars" }));
    expect(ics).toContain("Learn about stars");
  });

  it("includes geo coordinates when available", () => {
    const ics = generateIcs(makeEvent({ latitude: 37.43, longitude: -122.17 }));
    expect(ics).toContain("GEO:");
  });

  it("omits geo when coordinates are missing", () => {
    const ics = generateIcs(makeEvent({ latitude: null, longitude: null }));
    expect(ics).not.toContain("GEO:");
  });

  it("sets CANCELLED status for canceled events", () => {
    const ics = generateIcs(makeEvent({ isCanceled: true }));
    expect(ics).toContain("CANCELLED");
  });

  it("sets CONFIRMED status for active events", () => {
    const ics = generateIcs(makeEvent({ isCanceled: false }));
    expect(ics).toContain("CONFIRMED");
  });

  it("generates a unique UID", () => {
    const ics = generateIcs(makeEvent({ id: "unique-123" }));
    expect(ics).toContain("unique-123@lectureseeker");
  });

  it("handles events without an end time by defaulting to 1h duration", () => {
    const ics = generateIcs(makeEvent({ endTime: null }));
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DURATION:");
  });

  it("includes DTSTART and DTEND for events with end time", () => {
    const ics = generateIcs(makeEvent());
    expect(ics).toContain("DTSTART:");
    expect(ics).toContain("DTEND:");
  });

  it("handles events with null optional fields", () => {
    const ics = generateIcs(
      makeEvent({
        description: null,
        location: null,
        url: null,
        latitude: null,
        longitude: null,
      })
    );
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes URL when provided", () => {
    const ics = generateIcs(makeEvent({ url: "https://example.com/event" }));
    expect(ics).toContain("https://example.com/event");
  });

  it("includes PRODID in the calendar header", () => {
    const ics = generateIcs(makeEvent());
    expect(ics).toContain("PRODID:");
  });

  it("includes VERSION:2.0 header", () => {
    const ics = generateIcs(makeEvent());
    expect(ics).toContain("VERSION:2.0");
  });

  it("generates different UIDs for different event IDs", () => {
    const ics1 = generateIcs(makeEvent({ id: "event-aaa" }));
    const ics2 = generateIcs(makeEvent({ id: "event-bbb" }));
    expect(ics1).toContain("event-aaa@lectureseeker");
    expect(ics2).toContain("event-bbb@lectureseeker");
    expect(ics1).not.toContain("event-bbb@lectureseeker");
  });
});
