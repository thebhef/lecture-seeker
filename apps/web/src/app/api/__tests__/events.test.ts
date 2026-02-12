import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────
const { mockPrisma, mockSendInviteEmail, mockGenerateIcs } = vi.hoisted(() => ({
  mockPrisma: {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockSendInviteEmail: vi.fn(),
  mockGenerateIcs: vi.fn().mockReturnValue("BEGIN:VCALENDAR\nEND:VCALENDAR"),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email", () => ({ sendInviteEmail: mockSendInviteEmail }));
vi.mock("@/lib/ics-generator", () => ({ generateIcs: mockGenerateIcs }));

// ── Route handler imports (after mocks) ──────────────────────────────────────
import { GET as listEvents } from "../events/route";
import { GET as getEvent } from "../events/[id]/route";
import { GET as getEventIcs } from "../events/[id]/ics/route";
import { POST as sendInvite } from "../events/[id]/send-invite/route";
import { DELETE as clearEvents } from "../events/clear/route";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-001",
    sourceId: "src-001",
    sourceEventId: "ext-001",
    title: "Test Lecture",
    description: "A fascinating lecture",
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
    source: { name: "Stanford Events", slug: "stanford" },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated events with defaults", async () => {
    const events = [mockEvent()];
    mockPrisma.event.findMany.mockResolvedValue(events);
    mockPrisma.event.count.mockResolvedValue(1);

    const res = await listEvents(makeRequest("/api/events"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });
  });

  it("applies pagination parameters", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?page=2&limit=10"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it("filters by source slug", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?source=stanford"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { slug: "stanford" },
        }),
      })
    );
  });

  it("filters by eventType", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?eventType=lecture"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventType: "lecture" }),
      })
    );
  });

  it("filters by location (case-insensitive contains)", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?location=Room"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          location: { contains: "Room", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by isOnline", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?isOnline=true"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isOnline: true }),
      })
    );
  });

  it("performs full-text search with q parameter", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events?q=jazz"));

    const call = mockPrisma.event.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { title: { contains: "jazz", mode: "insensitive" } },
      { description: { contains: "jazz", mode: "insensitive" } },
      { location: { contains: "jazz", mode: "insensitive" } },
    ]);
  });

  it("filters by date range (startAfter and startBefore)", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    const after = "2026-06-01T00:00:00Z";
    const before = "2026-06-30T23:59:59Z";
    await listEvents(
      makeRequest(`/api/events?startAfter=${after}&startBefore=${before}`)
    );

    const call = mockPrisma.event.findMany.mock.calls[0][0];
    expect(call.where.startTime.gte).toEqual(new Date(after));
    expect(call.where.startTime.lte).toEqual(new Date(before));
  });

  it("post-filters events by time of day", async () => {
    const morningEvent = mockEvent({
      id: "evt-morning",
      startTime: new Date("2026-06-15T09:00:00Z"), // 9 AM UTC
    });
    const eveningEvent = mockEvent({
      id: "evt-evening",
      startTime: new Date("2026-06-15T20:00:00Z"), // 8 PM UTC
    });
    mockPrisma.event.findMany.mockResolvedValue([morningEvent, eveningEvent]);
    mockPrisma.event.count.mockResolvedValue(2);

    const res = await listEvents(makeRequest("/api/events?timeOfDay=morning"));
    const json = await res.json();

    // Morning is 6-12, so only the 9 AM event should pass
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("evt-morning");
  });

  it("returns 400 for invalid query parameters", async () => {
    const res = await listEvents(makeRequest("/api/events?page=-1"));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid query parameters");
    expect(json.details).toBeDefined();
  });

  it("returns 400 for invalid limit", async () => {
    const res = await listEvents(makeRequest("/api/events?limit=500"));
    expect(res.status).toBe(400);
  });

  it("combines multiple filters", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(
      makeRequest("/api/events?source=stanford&eventType=lecture&isOnline=false")
    );

    const call = mockPrisma.event.findMany.mock.calls[0][0];
    expect(call.where.source).toEqual({ slug: "stanford" });
    expect(call.where.eventType).toBe("lecture");
    expect(call.where.isOnline).toBe(false);
  });

  it("orders events by startTime ascending", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);

    await listEvents(makeRequest("/api/events"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { startTime: "asc" } })
    );
  });

  it("includes source name and slug in response", async () => {
    mockPrisma.event.findMany.mockResolvedValue([mockEvent()]);
    mockPrisma.event.count.mockResolvedValue(1);

    await listEvents(makeRequest("/api/events"));

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { source: { select: { name: true, slug: true } } },
      })
    );
  });

  it("calculates totalPages correctly", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(25);

    const res = await listEvents(makeRequest("/api/events?limit=10"));
    const json = await res.json();

    expect(json.pagination.totalPages).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/events/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a single event by id", async () => {
    const event = mockEvent();
    mockPrisma.event.findUnique.mockResolvedValue(event);

    const res = await getEvent(makeRequest("/api/events/evt-001"), makeParams("evt-001"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe("evt-001");
    expect(json.data.title).toBe("Test Lecture");
  });

  it("includes source details", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(mockEvent());

    await getEvent(makeRequest("/api/events/evt-001"), makeParams("evt-001"));

    expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: "evt-001" },
      include: { source: { select: { name: true, slug: true } } },
    });
  });

  it("returns 404 for non-existent event", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const res = await getEvent(
      makeRequest("/api/events/not-found"),
      makeParams("not-found")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Event not found");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/[id]/ics
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/events/[id]/ics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ICS content with correct headers", async () => {
    const event = mockEvent();
    mockPrisma.event.findUnique.mockResolvedValue(event);

    const res = await getEventIcs(
      makeRequest("/api/events/evt-001/ics"),
      makeParams("evt-001")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8"
    );
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".ics");

    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
  });

  it("sanitizes filename from event title", async () => {
    const event = mockEvent({ title: "Jazz & Blues: Live!" });
    mockPrisma.event.findUnique.mockResolvedValue(event);

    const res = await getEventIcs(
      makeRequest("/api/events/evt-001/ics"),
      makeParams("evt-001")
    );

    const disposition = res.headers.get("Content-Disposition")!;
    // Special characters should be replaced with underscores
    expect(disposition).not.toContain("&");
    expect(disposition).not.toContain(":");
    expect(disposition).not.toContain("!");
  });

  it("calls generateIcs with the event", async () => {
    const event = mockEvent();
    mockPrisma.event.findUnique.mockResolvedValue(event);

    await getEventIcs(
      makeRequest("/api/events/evt-001/ics"),
      makeParams("evt-001")
    );

    expect(mockGenerateIcs).toHaveBeenCalledWith(event);
  });

  it("returns 404 when event does not exist", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const res = await getEventIcs(
      makeRequest("/api/events/missing/ics"),
      makeParams("missing")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Event not found");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events/[id]/send-invite
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/events/[id]/send-invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an invite email and returns success", async () => {
    const event = mockEvent();
    mockPrisma.event.findUnique.mockResolvedValue(event);
    mockSendInviteEmail.mockResolvedValue(undefined);

    const req = makeRequest("/api/events/evt-001/send-invite", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("evt-001"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockGenerateIcs).toHaveBeenCalledWith(event);
    expect(mockSendInviteEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      eventTitle: "Test Lecture",
      icsContent: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });
  });

  it("returns 400 for invalid email", async () => {
    const req = makeRequest("/api/events/evt-001/send-invite", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("evt-001"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when email field is missing", async () => {
    const req = makeRequest("/api/events/evt-001/send-invite", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("evt-001"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when event does not exist", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/events/missing/send-invite", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("missing"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Event not found");
  });

  it("returns 500 when email sending fails", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(mockEvent());
    mockSendInviteEmail.mockRejectedValue(new Error("SMTP connection refused"));

    const req = makeRequest("/api/events/evt-001/send-invite", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("evt-001"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("SMTP connection refused");
  });

  it("returns generic error message for non-Error throws", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(mockEvent());
    mockSendInviteEmail.mockRejectedValue("unexpected");

    const req = makeRequest("/api/events/evt-001/send-invite", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await sendInvite(req, makeParams("evt-001"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to send email");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/events/clear
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/events/clear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes all events and returns count", async () => {
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 42 });

    const res = await clearEvents();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(42);
  });

  it("returns 0 when no events exist", async () => {
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 0 });

    const res = await clearEvents();
    const json = await res.json();

    expect(json.deleted).toBe(0);
  });
});
