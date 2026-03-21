import { describe, it, expect } from "vitest";
import { SOURCE_SLUGS, BUILT_IN_SOURCES, EVENT_TYPES, normalizeEventType, AUDIENCE_TYPES, normalizeAudience, inferAudienceFromText, AGE_GROUP_TYPES, normalizeAgeGroup } from "../constants";

describe("SOURCE_SLUGS", () => {
  it("contains all expected source slugs", () => {
    expect(SOURCE_SLUGS.STANFORD).toBe("stanford");
    expect(SOURCE_SLUGS.UC_BERKELEY).toBe("uc-berkeley");
    expect(SOURCE_SLUGS.CAL_BEARS).toBe("cal-bears");
    expect(SOURCE_SLUGS.CSM_OBSERVATORY).toBe("csm-observatory");
  });

  it("has exactly 12 sources", () => {
    expect(Object.keys(SOURCE_SLUGS)).toHaveLength(12);
  });
});

describe("BUILT_IN_SOURCES", () => {
  it("has exactly 12 built-in sources", () => {
    expect(BUILT_IN_SOURCES).toHaveLength(12);
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

  it("has exactly 11 event types", () => {
    expect(Object.keys(EVENT_TYPES)).toHaveLength(11);
  });

  it("does not include seminar as a standalone type", () => {
    expect(EVENT_TYPES).not.toHaveProperty("seminar");
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

  it("normalizes seminar, class, and course to lecture", () => {
    expect(normalizeEventType("seminar")).toBe("lecture");
    expect(normalizeEventType("Seminar")).toBe("lecture");
    expect(normalizeEventType("seminars")).toBe("lecture");
    expect(normalizeEventType("class")).toBe("lecture");
    expect(normalizeEventType("course")).toBe("lecture");
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

describe("AUDIENCE_TYPES", () => {
  it("maps lowercase keys to display names", () => {
    expect(AUDIENCE_TYPES.public).toBe("General Public");
    expect(AUDIENCE_TYPES.students).toBe("Students");
    expect(AUDIENCE_TYPES.faculty).toBe("Faculty & Staff");
    expect(AUDIENCE_TYPES.academic).toBe("Academic Community");
  });

  it("has exactly 4 audience types", () => {
    expect(Object.keys(AUDIENCE_TYPES)).toHaveLength(4);
  });
});

describe("normalizeAudience", () => {
  it("returns canonical keys as-is", () => {
    expect(normalizeAudience("public")).toBe("public");
    expect(normalizeAudience("students")).toBe("students");
    expect(normalizeAudience("faculty")).toBe("faculty");
    expect(normalizeAudience("academic")).toBe("academic");
  });

  it("normalizes known aliases", () => {
    expect(normalizeAudience("General Public")).toBe("public");
    expect(normalizeAudience("open to the public")).toBe("public");
    expect(normalizeAudience("Researchers")).toBe("academic");
    expect(normalizeAudience("graduate students")).toBe("students");
    expect(normalizeAudience("faculty and staff")).toBe("faculty");
  });

  it("is case-insensitive", () => {
    expect(normalizeAudience("GENERAL PUBLIC")).toBe("public");
    expect(normalizeAudience("Students")).toBe("students");
  });

  it("trims whitespace", () => {
    expect(normalizeAudience("  public  ")).toBe("public");
    expect(normalizeAudience(" General Public ")).toBe("public");
  });

  it("returns undefined for unrecognized strings", () => {
    expect(normalizeAudience("aliens")).toBeUndefined();
    expect(normalizeAudience("some random text")).toBeUndefined();
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(normalizeAudience(undefined)).toBeUndefined();
    expect(normalizeAudience(null)).toBeUndefined();
    expect(normalizeAudience("")).toBeUndefined();
  });
});

describe("inferAudienceFromText", () => {
  it("infers academic from thesis defense", () => {
    expect(inferAudienceFromText("PhD Thesis Defense: Stellar Evolution")).toBe("academic");
  });

  it("infers academic from tea talk", () => {
    expect(inferAudienceFromText("KIPAC Tea Talk: Dark Matter")).toBe("academic");
  });

  it("infers public from 'open to the public'", () => {
    expect(inferAudienceFromText("A talk open to the public about science")).toBe("public");
  });

  it("infers students from 'for students'", () => {
    expect(inferAudienceFromText("Workshop for students on resume writing")).toBe("students");
  });

  it("returns undefined when no keywords match", () => {
    expect(inferAudienceFromText("Concert in the park")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(inferAudienceFromText(undefined)).toBeUndefined();
    expect(inferAudienceFromText(null)).toBeUndefined();
  });
});

describe("AGE_GROUP_TYPES", () => {
  it("maps lowercase keys to display names", () => {
    expect(AGE_GROUP_TYPES.children).toBe("Children");
    expect(AGE_GROUP_TYPES.teens).toBe("Teens");
    expect(AGE_GROUP_TYPES.families).toBe("Families");
    expect(AGE_GROUP_TYPES.adults).toBe("Adults");
    expect(AGE_GROUP_TYPES.seniors).toBe("Seniors");
    expect(AGE_GROUP_TYPES.college).toBe("College Students");
  });

  it("has exactly 6 age group types", () => {
    expect(Object.keys(AGE_GROUP_TYPES)).toHaveLength(6);
  });
});

describe("normalizeAgeGroup", () => {
  it("returns canonical keys as-is", () => {
    expect(normalizeAgeGroup("children")).toBe("children");
    expect(normalizeAgeGroup("teens")).toBe("teens");
    expect(normalizeAgeGroup("families")).toBe("families");
    expect(normalizeAgeGroup("adults")).toBe("adults");
    expect(normalizeAgeGroup("seniors")).toBe("seniors");
    expect(normalizeAgeGroup("college")).toBe("college");
  });

  it("normalizes known aliases", () => {
    expect(normalizeAgeGroup("kids")).toBe("children");
    expect(normalizeAgeGroup("Preschoolers")).toBe("children");
    expect(normalizeAgeGroup("Young Adults")).toBe("teens");
    expect(normalizeAgeGroup("family")).toBe("families");
    expect(normalizeAgeGroup("family-friendly")).toBe("families");
    expect(normalizeAgeGroup("all ages")).toBe("families");
    expect(normalizeAgeGroup("senior")).toBe("seniors");
    expect(normalizeAgeGroup("older adults")).toBe("seniors");
    expect(normalizeAgeGroup("undergraduate")).toBe("college");
    expect(normalizeAgeGroup("graduate students")).toBe("college");
  });

  it("is case-insensitive", () => {
    expect(normalizeAgeGroup("CHILDREN")).toBe("children");
    expect(normalizeAgeGroup("Teens")).toBe("teens");
    expect(normalizeAgeGroup("KIDS")).toBe("children");
  });

  it("trims whitespace", () => {
    expect(normalizeAgeGroup("  children  ")).toBe("children");
    expect(normalizeAgeGroup(" families ")).toBe("families");
  });

  it("returns undefined for unrecognized strings", () => {
    expect(normalizeAgeGroup("aliens")).toBeUndefined();
    expect(normalizeAgeGroup("robots")).toBeUndefined();
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(normalizeAgeGroup(undefined)).toBeUndefined();
    expect(normalizeAgeGroup(null)).toBeUndefined();
    expect(normalizeAgeGroup("")).toBeUndefined();
  });
});


