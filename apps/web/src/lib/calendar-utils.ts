import type { EventWithSource } from "@/lib/types";

export const SOURCE_COLORS: Record<string, string> = {
  stanford: "#8C1515",
  "uc-berkeley": "#003262",
  "cal-bears": "#FDB515",
  "csm-observatory": "#2563eb",
};

const DEFAULT_COLOR = "#6b7280";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date | undefined;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  classNames: string[];
  extendedProps: { event: EventWithSource };
}

export function toCalendarEvents(
  events: EventWithSource[],
  now: Date = new Date()
): CalendarEvent[] {
  return events.map((event) => {
    const startTime = new Date(event.startTime);
    const endTime = event.endTime ? new Date(event.endTime) : undefined;
    const past = (endTime || startTime) < now;
    const color = SOURCE_COLORS[event.source.slug] || DEFAULT_COLOR;
    return {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      allDay: event.isAllDay,
      backgroundColor: color,
      borderColor: color,
      classNames: past ? ["fc-event-past"] : [],
      extendedProps: { event },
    };
  });
}
