import { createEvents, type DateArray, type EventAttributes } from "ics";
import type { Event } from "@prisma/client";

/** Explicit UTC components — avoids system-timezone dependency on the server. */
function toUtcDateArray(d: Date): DateArray {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

export function generateIcs(event: Event): string {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;

  const base = {
    start: toUtcDateArray(start),
    startInputType: "utc" as const,
    startOutputType: "utc" as const,
    title: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    url: event.url || undefined,
    geo:
      event.latitude && event.longitude
        ? { lat: event.latitude, lon: event.longitude }
        : undefined,
    status: (event.isCanceled ? "CANCELLED" : "CONFIRMED") as
      | "CANCELLED"
      | "CONFIRMED",
    uid: `${event.id}@lectureseeker`,
  };

  const icsEvent: EventAttributes = end
    ? { ...base, end: toUtcDateArray(end), endInputType: "utc" as const, endOutputType: "utc" as const }
    : { ...base, duration: { hours: 1 } };

  const { error, value } = createEvents([icsEvent]);
  if (error) throw new Error(`ICS generation failed: ${error}`);
  return value!;
}
