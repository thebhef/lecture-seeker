import { describe, it, expect } from "vitest";
import { SOURCE_SLUGS, BUILT_IN_SOURCES, EVENT_TYPES, TIME_OF_DAY, normalizeEventType } from "../constants";

describe("SOURCE_SLUGS", () => {
  it("contains all expected source slugs", () => {
    expect(SOURCE_SLUGS.STANFORD).toBe("stanford");
    expect(SOURCE_SLUGS.UC_BERKELEY).toBe("uc-berkeley");
    expect(SOURCE_SLUGS.CAL_BEARS).toBe("cal-bears");
    expect(SOURCE_SLUGS.CSM_OBSERVATORY).toBe("csm-observatory");
  });

  it("has exactly 4 sources", () => {
    expect(Object.keys(SOURCE_SLUGS)).toHaveLength(4);
  });
});

describe("BUILT_IN_SOURCES", () => {
  it("has exactly 4 built-in sources", () => {
    expect(BUILT_IN_SOURCES).toHaveLength(4);
  });

  it("each source has required fields", () => {
    for (const source of BUILT_IN_SOURCES) {
      expect(source.name).toBeTruthy();
      expect(source.slug).toBeTruthy();
      expect(source.type).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
    }
  });

  it("slugs match SOURCE_SLUGS values", () => {
    const slugs = BUILT_IN_SOURCES.map((s) => s.slug);
    expect(slugs).toContain(SOURCE_SLUGS.STANFORD);
    expect(slugs).toContain(SOURCE_SLUGS.UC_BERKELEY);
    expect(slugs).toContain(SOURCE_SLUGS.CAL_BEARS);
    expect(slugs).toContain(SOURCE_SLUGS.CSM_OBSERVATORY);
  });

  it("assigns correct types to each source", () => {
    const bySlug = Object.fromEntries(BUILT_IN_SOURCES.map((s) => [s.slug, s]));
    expect(bySlug["stanford"].type).toBe("API_JSON");
    expect(bySlug["uc-berkeley"].type).toBe("API_JSON");
    expect(bySlug["cal-bears"].type).toBe("ICS_FEED");
    expect(bySlug["csm-observatory"].type).toBe("HTML_SCRAPE");
  });
});

describe("EVENT_TYPES", () => {
  it("maps lowercase keys to display names", () => {
    expect(EVENT_TYPES.lecture).toBe("Lecture");
    expect(EVENT_TYPES.sports).toBe("Sports");
    expect(EVENT_TYPES.astronomy).toBe("Astronomy");
  });

  it("has at least 10 event types", () => {
    expect(Object.keys(EVENT_TYPES).length).toBeGreaterThanOrEqual(10);
  });
});

describe("normalizeEventType", () => {
  it("returns canonical keys as-is", () => {
    expect(normalizeEventType("lecture")).toBe("lecture");
    expect(normalizeEventType("exhibition")).toBe("exhibition");
    expect(normalizeEventType("sports")).toBe("sports");
    expect(normalizeEventType("concert")).toBe("concert");
  });

  it("normalizes known aliases", () => {
    expect(normalizeEventType("exhibit")).toBe("exhibition");
    expect(normalizeEventType("Exhibit")).toBe("exhibition");
    expect(normalizeEventType("talk")).toBe("lecture");
    expect(normalizeEventType("presentation")).toBe("lecture");
    expect(normalizeEventType("screening")).toBe("film");
    expect(normalizeEventType("performing arts")).toBe("performance");
    expect(normalizeEventType("symposium")).toBe("conference");
    expect(normalizeEventType("reception")).toBe("social");
    expect(normalizeEventType("athletics")).toBe("sports");
  });

  it("is case-insensitive", () => {
    expect(normalizeEventType("LECTURE")).toBe("lecture");
    expect(normalizeEventType("Exhibition")).toBe("exhibition");
    expect(normalizeEventType("TALK")).toBe("lecture");
  });

  it("trims whitespace", () => {
    expect(normalizeEventType("  lecture  ")).toBe("lecture");
    expect(normalizeEventType(" exhibit ")).toBe("exhibition");
  });

  it("returns undefined for unrecognized strings", () => {
    expect(normalizeEventType("Berkeley Graduate Student Conference")).toBeUndefined();
    expect(normalizeEventType("Some Random Exhibition Title")).toBeUndefined();
    expect(normalizeEventType("xyz")).toBeUndefined();
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(normalizeEventType(undefined)).toBeUndefined();
    expect(normalizeEventType(null)).toBeUndefined();
    expect(normalizeEventType("")).toBeUndefined();
  });
});

describe("TIME_OF_DAY", () => {
  it("defines morning, afternoon, and evening buckets", () => {
    expect(TIME_OF_DAY.morning).toBeDefined();
    expect(TIME_OF_DAY.afternoon).toBeDefined();
    expect(TIME_OF_DAY.evening).toBeDefined();
  });

  it("morning covers 6am to noon", () => {
    expect(TIME_OF_DAY.morning.start).toBe(6);
    expect(TIME_OF_DAY.morning.end).toBe(12);
  });

  it("afternoon covers noon to 5pm", () => {
    expect(TIME_OF_DAY.afternoon.start).toBe(12);
    expect(TIME_OF_DAY.afternoon.end).toBe(17);
  });

  it("evening covers 5pm to midnight", () => {
    expect(TIME_OF_DAY.evening.start).toBe(17);
    expect(TIME_OF_DAY.evening.end).toBe(24);
  });

  it("buckets cover the full day contiguously from 6am", () => {
    expect(TIME_OF_DAY.morning.end).toBe(TIME_OF_DAY.afternoon.start);
    expect(TIME_OF_DAY.afternoon.end).toBe(TIME_OF_DAY.evening.start);
  });
});
