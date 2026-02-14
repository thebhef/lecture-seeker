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
    url: "https://collegeofsanmateo.edu/astronomy/observatory.asp",
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
];

export const EVENT_TYPES: Record<string, string> = {
  lecture: "Lecture",
  exhibition: "Exhibition",
  performance: "Performance",
  sports: "Sports",
  workshop: "Workshop",
  conference: "Conference",
  seminar: "Seminar",
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
  // seminar variants
  seminars: "seminar",
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