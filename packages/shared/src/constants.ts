export const SOURCE_SLUGS = {
  STANFORD: "stanford",
  UC_BERKELEY: "uc-berkeley",
  CAL_BEARS: "cal-bears",
  CSM_OBSERVATORY: "csm-observatory",
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

export const TIME_OF_DAY = {
  morning: { start: 6, end: 12, label: "Morning (6am-12pm)" },
  afternoon: { start: 12, end: 17, label: "Afternoon (12pm-5pm)" },
  evening: { start: 17, end: 24, label: "Evening (5pm+)" },
} as const;
