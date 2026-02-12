"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventWithSource } from "@/lib/types";

interface CalendarViewProps {
  events: EventWithSource[];
  onSelect: (event: EventWithSource) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  stanford: "#8C1515",
  "uc-berkeley": "#003262",
  "cal-bears": "#FDB515",
  "csm-observatory": "#2563eb",
};

export function CalendarView({ events, onSelect }: CalendarViewProps) {
  const now = new Date();
  const calendarEvents = events.map((event) => {
    const eventEnd = event.endTime ? new Date(event.endTime) : new Date(event.startTime);
    const past = eventEnd < now;
    return {
      id: event.id,
      title: event.title,
      start: event.startTime,
      end: event.endTime || undefined,
      allDay: event.isAllDay,
      backgroundColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
      borderColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
      classNames: past ? ["fc-event-past"] : [],
      extendedProps: { event },
    };
  });

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
        events={calendarEvents}
        eventClick={(info) => {
          const event = info.event.extendedProps.event as EventWithSource;
          onSelect(event);
        }}
        height="auto"
        eventDisplay="block"
        dayMaxEvents={3}
        nowIndicator
      />
      <style jsx global>{`
        .calendar-wrapper .fc {
          --fc-border-color: var(--color-border);
          --fc-button-bg-color: var(--color-primary);
          --fc-button-border-color: var(--color-primary);
          --fc-button-hover-bg-color: color-mix(in srgb, var(--color-primary), black 10%);
          --fc-button-hover-border-color: color-mix(in srgb, var(--color-primary), black 10%);
          --fc-button-active-bg-color: color-mix(in srgb, var(--color-primary), black 20%);
          --fc-button-active-border-color: color-mix(in srgb, var(--color-primary), black 20%);
          --fc-today-bg-color: color-mix(in srgb, var(--color-primary), transparent 95%);
          font-size: 0.875rem;
        }
        .calendar-wrapper .fc-event {
          cursor: pointer;
          font-size: 0.75rem;
          padding: 1px 3px;
        }
        .calendar-wrapper .fc .fc-toolbar-title {
          font-size: 1.125rem;
          font-weight: 600;
        }
        .calendar-wrapper .fc-event-past {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
