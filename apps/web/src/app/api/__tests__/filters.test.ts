import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    event: {
      findMany: vi.fn(),
    },
    source: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Route handler import ─────────────────────────────────────────────────────
import { GET as getFilters } from "../filters/route";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/filters
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/filters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns event types, sources, and locations", async () => {
    mockPrisma.event.findMany
      // First call: distinct eventTypes
      .mockResolvedValueOnce([
        { eventType: "concert" },
        { eventType: "lecture" },
        { eventType: "workshop" },
      ])
      // Second call: distinct locations
      .mockResolvedValueOnce([
        { location: "Doe Library" },
        { location: "Memorial Auditorium" },
      ]);

    mockPrisma.source.findMany.mockResolvedValue([
      { slug: "stanford", name: "Stanford Events" },
      { slug: "uc-berkeley", name: "UC Berkeley Events" },
    ]);

    const res = await getFilters();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.eventTypes).toEqual(["concert", "lecture", "workshop"]);
    expect(json.sources).toEqual([
      { slug: "stanford", name: "Stanford Events" },
      { slug: "uc-berkeley", name: "UC Berkeley Events" },
    ]);
    expect(json.locations).toEqual(["Doe Library", "Memorial Auditorium"]);
  });

  it("returns empty arrays when no data exists", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    const res = await getFilters();
    const json = await res.json();

    expect(json.eventTypes).toEqual([]);
    expect(json.sources).toEqual([]);
    expect(json.locations).toEqual([]);
  });

  it("only returns enabled sources", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    await getFilters();

    expect(mockPrisma.source.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: true },
      })
    );
  });

  it("queries distinct event types excluding nulls", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    await getFilters();

    // First findMany call is for event types
    const eventTypeCall = mockPrisma.event.findMany.mock.calls[0][0];
    expect(eventTypeCall.where).toEqual({ eventType: { not: null } });
    expect(eventTypeCall.distinct).toEqual(["eventType"]);
  });

  it("limits locations to 100", async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    await getFilters();

    // Second findMany call is for locations
    const locationCall = mockPrisma.event.findMany.mock.calls[1][0];
    expect(locationCall.take).toBe(100);
    expect(locationCall.distinct).toEqual(["location"]);
  });

  it("filters out null event types from the response", async () => {
    mockPrisma.event.findMany
      .mockResolvedValueOnce([
        { eventType: "lecture" },
        { eventType: null },
        { eventType: "concert" },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    const res = await getFilters();
    const json = await res.json();

    expect(json.eventTypes).toEqual(["lecture", "concert"]);
    expect(json.eventTypes).not.toContain(null);
  });

  it("filters out null locations from the response", async () => {
    mockPrisma.event.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { location: "Library" },
        { location: null },
      ]);
    mockPrisma.source.findMany.mockResolvedValue([]);

    const res = await getFilters();
    const json = await res.json();

    expect(json.locations).toEqual(["Library"]);
    expect(json.locations).not.toContain(null);
  });
});
