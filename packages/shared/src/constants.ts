// ── API query limits ──────────────────────────────────────────────
export const API_DEFAULT_LIMIT = 50;
export const API_MAX_LIMIT = 2000;
export const API_CALENDAR_LIMIT = 1500;

// Default hour (0-23) for the "start after" filter when no date range is set
export const DEFAULT_START_HOUR = 18;

// ── Source slugs ──────────────────────────────────────────────────
export const SOURCE_SLUGS = {
  STANFORD: "stanford",
  UC_BERKELEY: "uc-berkeley",
  CAL_BEARS: "cal-bears",
  CSM_OBSERVATORY: "csm-observatory",
  SHORELINE_AMPHITHEATRE: "shoreline-amphitheatre",
  GREEK_THEATRE: "greek-theatre",
  CAL_ACADEMY: "cal-academy",
  COMPUTER_HISTORY_MUSEUM: "computer-history-museum",
  KIPAC: "kipac",
  SJSU: "sjsu",
  CAL_STATE_LIBRARY: "cal-state-library",
  SAN_MATEO_LIBRARY: "san-mateo-library",
} as const;

export const BUILT_IN_SOURCES = [
  {
    name: "Stanford Events",
    slug: SOURCE_SLUGS.STANFORD,
    type: "API_JSON" as const,
    url: "https://events.stanford.edu/api/2/events",
  },
  {
    name: "UC Berkeley Events",
    slug: SOURCE_SLUGS.UC_BERKELEY,
    type: "API_JSON" as const,
    url: "https://events.berkeley.edu/live/json/events/",
  },
  {
    name: "Cal Bears Athletics",
    slug: SOURCE_SLUGS.CAL_BEARS,
    type: "ICS_FEED" as const,
    url: "https://calbears.com/calendar.ashx/calendar.ics",
  },
  {
    name: "CSM Observatory",
    slug: SOURCE_SLUGS.CSM_OBSERVATORY,
    type: "HTML_SCRAPE" as const,
    url: "https://collegeofsanmateo.edu/astronomy/",
  },
  {
    name: "Shoreline Amphitheatre",
    slug: SOURCE_SLUGS.SHORELINE_AMPHITHEATRE,
    type: "HTML_SCRAPE" as const,
    url: "https://www.livenation.com/venue/KovZpZA6ta1A/shoreline-amphitheatre-events",
  },
  {
    name: "Greek Theatre Berkeley",
    slug: SOURCE_SLUGS.GREEK_THEATRE,
    type: "HTML_SCRAPE" as const,
    url: "https://thegreekberkeley.com/calendar/",
  },
  {
    name: "Cal Academy of Sciences",
    slug: SOURCE_SLUGS.CAL_ACADEMY,
    type: "HTML_SCRAPE" as const,
    url: "https://www.calacademy.org/daily-calendar",
  },
  {
    name: "Computer History Museum",
    slug: SOURCE_SLUGS.COMPUTER_HISTORY_MUSEUM,
    type: "HTML_SCRAPE" as const,
    url: "https://computerhistory.org/events/",
  },
  {
    name: "KIPAC Stanford",
    slug: SOURCE_SLUGS.KIPAC,
    type: "API_JSON" as const,
    url: "https://kipac.stanford.edu/jsonapi/node/stanford_event",
  },
  {
    name: "SJSU Events",
    slug: SOURCE_SLUGS.SJSU,
    type: "API_JSON" as const,
    url: "https://events.sjsu.edu/api/2/events",
  },
  {
    name: "California State Library",
    slug: SOURCE_SLUGS.CAL_STATE_LIBRARY,
    type: "ICS_FEED" as const,
    url: "https://libraryca.libcal.com/ical_subscribe.php?src=p&cid=17752",
  },
  {
    name: "San Mateo County Library",
    slug: SOURCE_SLUGS.SAN_MATEO_LIBRARY,
    type: "API_JSON" as const,
    url: "https://gateway.bibliocommons.com/v2/libraries/smcl/events",
  },
];

export const EVENT_TYPES: Record<string, string> = {
  lecture: "Lecture",
  exhibition: "Exhibition",
  performance: "Performance",
  sports: "Sports",
  workshop: "Workshop",
  conference: "Conference",
  concert: "Concert",
  film: "Film",
  astronomy: "Astronomy",
  social: "Social",
  other: "Other",
};

// Maps variant strings to canonical event type keys
const EVENT_TYPE_ALIASES: Record<string, string> = {
  // exhibition variants
  exhibit: "exhibition",
  exhibits: "exhibition",
  gallery: "exhibition",
  "art exhibit": "exhibition",
  "art exhibition": "exhibition",
  // lecture variants
  talk: "lecture",
  talks: "lecture",
  presentation: "lecture",
  "lecture/panel": "lecture",
  "lecture/presentation/talk": "lecture",
  seminar: "lecture",
  seminars: "lecture",
  class: "lecture",
  course: "lecture",
  // performance variants
  "performing arts": "performance",
  performances: "performance",
  theater: "performance",
  theatre: "performance",
  dance: "performance",
  recital: "performance",
  // concert variants
  concerts: "concert",
  music: "concert",
  // workshop variants
  workshops: "workshop",
  training: "workshop",
  // conference variants
  symposium: "conference",
  colloquium: "conference",
  forum: "conference",
  // film variants
  screening: "film",
  "film screening": "film",
  films: "film",
  // social variants
  reception: "social",
  mixer: "social",
  networking: "social",
  "career/job": "social",
  // sports variants
  athletics: "sports",
  game: "sports",
  match: "sports",
  // library / BiblioCommons variants
  "book club": "social",
  "book discussion": "social",
  crafts: "workshop",
  "arts, crafts, diy": "workshop",
  "arts and crafts": "workshop",
  "storytime": "performance",
  "story time": "performance",
  "author talk": "lecture",
  "author event": "lecture",
  "author visit": "lecture",
  "stem/steam": "workshop",
  "technology": "workshop",
  meeting: "social",
  "health, wellness": "workshop",
  webinar: "lecture",
};

/**
 * Normalizes an event type string to a canonical EVENT_TYPES key.
 * Returns the canonical key if recognized, or undefined if the input
 * doesn't match any known event type or alias.
 */
export function normalizeEventType(
  raw: string | undefined | null
): string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower in EVENT_TYPES) return lower;
  if (lower in EVENT_TYPE_ALIASES) return EVENT_TYPE_ALIASES[lower];
  return undefined;
}

// ── Audience types ──────────────────────────────────────────────────
export const AUDIENCE_TYPES: Record<string, string> = {
  public: "General Public",
  students: "Students",
  faculty: "Faculty & Staff",
  academic: "Academic Community",
};

// Maps variant strings to canonical audience type keys
const AUDIENCE_ALIASES: Record<string, string> = {
  // public variants
  "general public": "public",
  "open to the public": "public",
  "open to public": "public",
  "all ages": "public",
  community: "public",
  general: "public",
  everyone: "public",
  "free and open to the public": "public",
  // students variants
  student: "students",
  undergraduate: "students",
  graduate: "students",
  "graduate students": "students",
  "undergraduate students": "students",
  // faculty variants
  staff: "faculty",
  "faculty/staff": "faculty",
  "faculty and staff": "faculty",
  employees: "faculty",
  // academic variants
  researchers: "academic",
  scholars: "academic",
  "academic community": "academic",
  "research community": "academic",
  "faculty and students": "academic",
  // library audience variants
  adults: "public",
  teens: "public",
  children: "public",
  families: "public",
  "kids": "public",
  "preschoolers": "public",
  "young adults": "public",
};

/**
 * Normalizes an audience string to a canonical AUDIENCE_TYPES key.
 * Returns the canonical key if recognized, or undefined if the input
 * doesn't match any known audience type or alias.
 */
export function normalizeAudience(
  raw: string | undefined | null
): string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower in AUDIENCE_TYPES) return lower;
  if (lower in AUDIENCE_ALIASES) return AUDIENCE_ALIASES[lower];
  return undefined;
}

/**
 * Infers audience from text content (title + description) using keyword matching.
 * Returns a canonical audience key or undefined.
 */
export function inferAudienceFromText(
  text: string | undefined | null
): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (/\b(thesis defense|dissertation|colloqui|seminar series|research talk|tea talk)\b/.test(lower)) {
    return "academic";
  }
  if (/\b(for students|student only|student event|undergraduate workshop|graduate student)\b/.test(lower)) {
    return "students";
  }
  if (/\b(faculty meeting|staff only|for faculty|employee)\b/.test(lower)) {
    return "faculty";
  }
  if (/\b(open to the public|general public|all ages|free public|community event|public event)\b/.test(lower)) {
    return "public";
  }
  return undefined;
}

// ── Map defaults ──────────────────────────────────────────────────
// Center of the Bay Area (approximately San Mateo Bridge midpoint)
export const MAP_DEFAULT_CENTER = { lat: 37.55, lng: -122.1 } as const;
export const MAP_DEFAULT_ZOOM = 10;
export const MAP_DEFAULT_RADIUS_MILES = 50;
export const MAP_MAX_RADIUS_MILES = 100;

// ── Ollama classification defaults ──────────────────────────────────
export const OLLAMA_DEFAULT_URL = "http://host.docker.internal:11434";
export const OLLAMA_DEFAULT_MODEL = "gemma3:4b";
export const OLLAMA_DEFAULT_BATCH_SIZE = 10;
export const OLLAMA_DEFAULT_TIMEOUT_MS = 120000;

// ── Age group types ──────────────────────────────────────────────────
export const AGE_GROUP_TYPES: Record<string, string> = {
  children: "Children",
  teens: "Teens",
  families: "Families",
  adults: "Adults",
  seniors: "Seniors",
  college: "College Students",
};

// Maps variant strings to canonical age group keys
const AGE_GROUP_ALIASES: Record<string, string> = {
  // children variants
  kids: "children",
  kid: "children",
  child: "children",
  preschoolers: "children",
  preschool: "children",
  toddler: "children",
  toddlers: "children",
  "young children": "children",
  // teens variants
  teen: "teens",
  teenager: "teens",
  teenagers: "teens",
  "young adults": "teens",
  "young adult": "teens",
  "middle school": "teens",
  "high school": "teens",
  // families variants
  family: "families",
  "family-friendly": "families",
  "all ages": "families",
  // adults variants
  adult: "adults",
  // seniors variants
  senior: "seniors",
  "older adults": "seniors",
  retired: "seniors",
  // college variants
  "college students": "college",
  undergraduate: "college",
  graduate: "college",
  "graduate students": "college",
  "undergraduate students": "college",
};

/**
 * Normalizes an age group string to a canonical AGE_GROUP_TYPES key.
 * Returns the canonical key if recognized, or undefined if the input
 * doesn't match any known age group or alias.
 */
export function normalizeAgeGroup(
  raw: string | undefined | null
): string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower in AGE_GROUP_TYPES) return lower;
  if (lower in AGE_GROUP_ALIASES) return AGE_GROUP_ALIASES[lower];
  return undefined;
}