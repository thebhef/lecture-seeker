import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    source: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    event: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Route handler imports ────────────────────────────────────────────────────
import { GET as listSources, POST as createSource } from "../sources/route";
import {
  PATCH as patchSource,
  DELETE as deleteSource,
} from "../sources/[id]/route";
import { DELETE as deleteSourceEvents } from "../sources/[id]/events/route";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "src-001",
    name: "Stanford Events",
    slug: "stanford",
    type: "API_JSON",
    url: "https://events.stanford.edu/api/2/events",
    config: null,
    enabled: true,
    isBuiltIn: true,
    lastScrapedAt: null,
    lastError: null,
    lastScrapeEvents: 0,
    lastScrapeNew: 0,
    lastScrapeDuration: 0,
    totalEvents: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { events: 100 },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sources
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all sources with event counts and date ranges", async () => {
    const sources = [
      mockSource(),
      mockSource({
        id: "src-002",
        name: "UC Berkeley Events",
        slug: "uc-berkeley",
        _count: { events: 50 },
      }),
    ];
    mockPrisma.source.findMany.mockResolvedValue(sources);
    mockPrisma.event.findFirst.mockResolvedValue(null);

    const res = await listSources();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].name).toBe("Stanford Events");
    expect(json.data[1].name).toBe("UC Berkeley Events");
  });

  it("orders sources by name ascending", async () => {
    mockPrisma.source.findMany.mockResolvedValue([]);

    await listSources();

    expect(mockPrisma.source.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } })
    );
  });

  it("includes event counts", async () => {
    mockPrisma.source.findMany.mockResolvedValue([]);

    await listSources();

    expect(mockPrisma.source.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { events: true } } },
      })
    );
  });

  it("enriches sources with earliest/latest event dates", async () => {
    const source = mockSource();
    mockPrisma.source.findMany.mockResolvedValue([source]);

    const earliest = new Date("2026-01-01T00:00:00Z");
    const latest = new Date("2026-12-31T23:59:59Z");

    mockPrisma.event.findFirst
      .mockResolvedValueOnce({ startTime: earliest })
      .mockResolvedValueOnce({ startTime: latest });

    const res = await listSources();
    const json = await res.json();

    expect(json.data[0].earliestEvent).toBe(earliest.toISOString());
    expect(json.data[0].latestEvent).toBe(latest.toISOString());
  });

  it("returns null dates when source has no events", async () => {
    mockPrisma.source.findMany.mockResolvedValue([mockSource()]);
    mockPrisma.event.findFirst.mockResolvedValue(null);

    const res = await listSources();
    const json = await res.json();

    expect(json.data[0].earliestEvent).toBeNull();
    expect(json.data[0].latestEvent).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sources
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new ICS_FEED source", async () => {
    const created = mockSource({
      id: "src-new",
      name: "My Calendar",
      slug: "my-calendar",
      type: "ICS_FEED",
      isBuiltIn: false,
    });
    mockPrisma.source.findUnique.mockResolvedValue(null);
    mockPrisma.source.create.mockResolvedValue(created);

    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "My Calendar",
        url: "https://example.com/cal.ics",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.slug).toBe("my-calendar");
    expect(mockPrisma.source.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "My Calendar",
        slug: "my-calendar",
        type: "ICS_FEED",
        url: "https://example.com/cal.ics",
        isBuiltIn: false,
        enabled: true,
      }),
    });
  });

  it("generates a slug from the name", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);
    mockPrisma.source.create.mockResolvedValue(
      mockSource({ slug: "my-cool-calendar" })
    );

    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "My Cool Calendar!",
        url: "https://example.com/cal.ics",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await createSource(req);

    expect(mockPrisma.source.findUnique).toHaveBeenCalledWith({
      where: { slug: "my-cool-calendar" },
    });
  });

  it("returns 409 when a source with the same slug exists", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(mockSource());

    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "Stanford",
        url: "https://example.com/cal.ics",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("already exists");
  });

  it("returns 400 for missing name", async () => {
    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/cal.ics",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid URL", async () => {
    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        url: "not-a-url",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type (only ICS_FEED allowed)", async () => {
    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        url: "https://example.com/api",
        type: "API_JSON",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty name", async () => {
    const req = makeRequest("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: "",
        url: "https://example.com/cal.ics",
        type: "ICS_FEED",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await createSource(req);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sources/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /api/sources/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the enabled flag", async () => {
    const source = mockSource();
    mockPrisma.source.findUnique.mockResolvedValue(source);
    mockPrisma.source.update.mockResolvedValue({ ...source, enabled: false });

    const req = makeRequest("/api/sources/src-001", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await patchSource(req, makeParams("src-001"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.source.update).toHaveBeenCalledWith({
      where: { id: "src-001" },
      data: { enabled: false },
    });
    expect(json.data.enabled).toBe(false);
  });

  it("updates the URL", async () => {
    const source = mockSource();
    mockPrisma.source.findUnique.mockResolvedValue(source);
    mockPrisma.source.update.mockResolvedValue({
      ...source,
      url: "https://new-url.com/feed.ics",
    });

    const req = makeRequest("/api/sources/src-001", {
      method: "PATCH",
      body: JSON.stringify({ url: "https://new-url.com/feed.ics" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await patchSource(req, makeParams("src-001"));

    expect(res.status).toBe(200);
    expect(mockPrisma.source.update).toHaveBeenCalledWith({
      where: { id: "src-001" },
      data: { url: "https://new-url.com/feed.ics" },
    });
  });

  it("ignores unknown fields in the body", async () => {
    const source = mockSource();
    mockPrisma.source.findUnique.mockResolvedValue(source);
    mockPrisma.source.update.mockResolvedValue(source);

    const req = makeRequest("/api/sources/src-001", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hacked", enabled: true }),
      headers: { "Content-Type": "application/json" },
    });

    await patchSource(req, makeParams("src-001"));

    // Only 'enabled' should be in updateData, not 'name'
    expect(mockPrisma.source.update).toHaveBeenCalledWith({
      where: { id: "src-001" },
      data: { enabled: true },
    });
  });

  it("returns 404 for non-existent source", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/sources/missing", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await patchSource(req, makeParams("missing"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Source not found");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/sources/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/sources/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a custom source", async () => {
    const source = mockSource({ isBuiltIn: false });
    mockPrisma.source.findUnique.mockResolvedValue(source);
    mockPrisma.source.delete.mockResolvedValue(source);

    const res = await deleteSource(
      makeRequest("/api/sources/src-001", { method: "DELETE" }),
      makeParams("src-001")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockPrisma.source.delete).toHaveBeenCalledWith({
      where: { id: "src-001" },
    });
  });

  it("returns 403 when trying to delete a built-in source", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(
      mockSource({ isBuiltIn: true })
    );

    const res = await deleteSource(
      makeRequest("/api/sources/src-001", { method: "DELETE" }),
      makeParams("src-001")
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Cannot delete built-in");
    expect(mockPrisma.source.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for non-existent source", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);

    const res = await deleteSource(
      makeRequest("/api/sources/missing", { method: "DELETE" }),
      makeParams("missing")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Source not found");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/sources/[id]/events
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/sources/[id]/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes all events for a source and returns count", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(mockSource());
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 15 });

    const res = await deleteSourceEvents(
      makeRequest("/api/sources/src-001/events", { method: "DELETE" }),
      makeParams("src-001")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(15);
    expect(mockPrisma.event.deleteMany).toHaveBeenCalledWith({
      where: { sourceId: "src-001" },
    });
  });

  it("returns 404 when source does not exist", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);

    const res = await deleteSourceEvents(
      makeRequest("/api/sources/missing/events", { method: "DELETE" }),
      makeParams("missing")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Source not found");
  });

  it("returns 0 deleted when source has no events", async () => {
    mockPrisma.source.findUnique.mockResolvedValue(mockSource());
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 0 });

    const res = await deleteSourceEvents(
      makeRequest("/api/sources/src-001/events", { method: "DELETE" }),
      makeParams("src-001")
    );
    const json = await res.json();

    expect(json.deleted).toBe(0);
  });
});
