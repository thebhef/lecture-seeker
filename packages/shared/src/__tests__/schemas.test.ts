import { describe, it, expect } from "vitest";
import { eventQuerySchema, createSourceSchema, sendInviteSchema, EVENT_QUERY_MAX_LIMIT } from "../schemas";

describe("eventQuerySchema", () => {
  it("applies defaults for page and limit", () => {
    const result = eventQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it("coerces string numbers to integers", () => {
    const result = eventQuerySchema.parse({ page: "3", limit: "25" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(25);
  });

  it("rejects negative page numbers", () => {
    const result = eventQuerySchema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });

  it(`rejects limit above ${EVENT_QUERY_MAX_LIMIT}`, () => {
    const result = eventQuerySchema.safeParse({ limit: String(EVENT_QUERY_MAX_LIMIT + 1) });
    expect(result.success).toBe(false);
  });

  it("parses startAfter as a date", () => {
    const result = eventQuerySchema.parse({ startAfter: "2026-03-01T00:00:00Z" });
    expect(result.startAfter).toBeInstanceOf(Date);
    expect(result.startAfter!.getFullYear()).toBe(2026);
  });

  it("parses optional string filters", () => {
    const result = eventQuerySchema.parse({
      source: "stanford",
      eventType: "lecture",
      location: "Room 101",
      q: "astronomy",
    });
    expect(result.source).toBe("stanford");
    expect(result.eventType).toBe("lecture");
    expect(result.location).toBe("Room 101");
    expect(result.q).toBe("astronomy");
  });

  it("transforms isOnline string to boolean", () => {
    const trueResult = eventQuerySchema.parse({ isOnline: "true" });
    expect(trueResult.isOnline).toBe(true);

    const falseResult = eventQuerySchema.parse({ isOnline: "false" });
    expect(falseResult.isOnline).toBe(false);
  });

  it("validates timeOfDay enum", () => {
    expect(eventQuerySchema.parse({ timeOfDay: "morning" }).timeOfDay).toBe("morning");
    expect(eventQuerySchema.parse({ timeOfDay: "afternoon" }).timeOfDay).toBe("afternoon");
    expect(eventQuerySchema.parse({ timeOfDay: "evening" }).timeOfDay).toBe("evening");

    const invalid = eventQuerySchema.safeParse({ timeOfDay: "midnight" });
    expect(invalid.success).toBe(false);
  });

  it("leaves optional fields undefined when not provided", () => {
    const result = eventQuerySchema.parse({});
    expect(result.source).toBeUndefined();
    expect(result.eventType).toBeUndefined();
    expect(result.q).toBeUndefined();
    expect(result.timeOfDay).toBeUndefined();
    expect(result.isOnline).toBeUndefined();
  });

  it("parses startBefore as a date", () => {
    const result = eventQuerySchema.parse({ startBefore: "2026-12-31T23:59:59Z" });
    expect(result.startBefore).toBeInstanceOf(Date);
    expect(result.startBefore!.getFullYear()).toBe(2026);
  });

  it("accepts limit at boundary value of 1", () => {
    const result = eventQuerySchema.parse({ limit: "1" });
    expect(result.limit).toBe(1);
  });

  it("accepts limit at boundary value of 200", () => {
    const result = eventQuerySchema.parse({ limit: "200" });
    expect(result.limit).toBe(200);
  });

  it("rejects limit of 0", () => {
    const result = eventQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects page of 0", () => {
    const result = eventQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric page values", () => {
    const result = eventQuerySchema.safeParse({ page: "abc" });
    expect(result.success).toBe(false);
  });

  it("supports both startAfter and startBefore together", () => {
    const result = eventQuerySchema.parse({
      startAfter: "2026-01-01T00:00:00Z",
      startBefore: "2026-12-31T23:59:59Z",
    });
    expect(result.startAfter).toBeInstanceOf(Date);
    expect(result.startBefore).toBeInstanceOf(Date);
    expect(result.startAfter!.getTime()).toBeLessThan(result.startBefore!.getTime());
  });
});

describe("createSourceSchema", () => {
  it("validates a correct source", () => {
    const result = createSourceSchema.parse({
      name: "My Calendar",
      url: "https://example.com/calendar.ics",
      type: "ICS_FEED",
    });
    expect(result.name).toBe("My Calendar");
    expect(result.url).toBe("https://example.com/calendar.ics");
    expect(result.type).toBe("ICS_FEED");
  });

  it("rejects empty name", () => {
    const result = createSourceSchema.safeParse({
      name: "",
      url: "https://example.com/cal.ics",
      type: "ICS_FEED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = createSourceSchema.safeParse({
      name: "Test",
      url: "not-a-url",
      type: "ICS_FEED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported source types", () => {
    const result = createSourceSchema.safeParse({
      name: "Test",
      url: "https://example.com/events",
      type: "HTML_SCRAPE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects names over 200 characters", () => {
    const result = createSourceSchema.safeParse({
      name: "A".repeat(201),
      url: "https://example.com/cal.ics",
      type: "ICS_FEED",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendInviteSchema", () => {
  it("validates a correct email", () => {
    const result = sendInviteSchema.parse({ email: "user@example.com" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(sendInviteSchema.safeParse({ email: "not-email" }).success).toBe(false);
    expect(sendInviteSchema.safeParse({ email: "" }).success).toBe(false);
    expect(sendInviteSchema.safeParse({}).success).toBe(false);
  });
});
