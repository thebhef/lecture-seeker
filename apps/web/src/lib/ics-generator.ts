import { createEvents, type DateArray, type EventAttributes } from "ics";
import type { Event } from "@prisma/client";

function toDateArray(d: Date): DateArray {
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}

export function generateIcs(event: Event): string {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;

  const base = {
    start: toDateArray(start),
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
    ? { ...base, end: toDateArray(end) }
    : { ...base, duration: { hours: 1 } };

  const { error, value } = createEvents([icsEvent]);
  if (error) throw new Error(`ICS generation failed: ${error}`);
  return value!;
}
