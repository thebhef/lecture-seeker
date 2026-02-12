"use client";

import { useEffect, useRef, useState } from "react";
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

function buildCalendarEvents(events: EventWithSource[]) {
  const now = new Date();
  return events.map((event) => {
    const startTime = new Date(event.startTime);
    const endTime = event.endTime ? new Date(event.endTime) : undefined;
    const past = (endTime || startTime) < now;
    return {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      allDay: event.isAllDay,
      backgroundColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
      borderColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
      classNames: past ? ["fc-event-past"] : [],
      extendedProps: { event },
    };
  });
}

export function CalendarView({ events, onSelect }: CalendarViewProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  // Initialize FullCalendar imperatively to avoid SSR issues
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { Calendar } = await import("@fullcalendar/core");
      const dayGridPlugin = (await import("@fullcalendar/daygrid")).default;
      const timeGridPlugin = (await import("@fullcalendar/timegrid")).default;
      const listPlugin = (await import("@fullcalendar/list")).default;

      if (!mounted || !calendarRef.current) return;

      const calendar = new Calendar(calendarRef.current, {
        plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
        initialView: "dayGridMonth",
        headerToolbar: {
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        },
        events: [],
        eventClick: (info) => {
          const event = info.event.extendedProps.event as EventWithSource;
          onSelectRef.current(event);
        },
        height: "auto",
        eventDisplay: "block",
        dayMaxEvents: 3,
        nowIndicator: true,
      });

      calendar.render();
      calendarInstanceRef.current = calendar;
      setReady(true);
    }

    init();

    return () => {
      mounted = false;
      calendarInstanceRef.current?.destroy();
      calendarInstanceRef.current = null;
    };
  }, []);

  // Update events when data changes or calendar becomes ready
  useEffect(() => {
    const calendar = calendarInstanceRef.current;
    if (!calendar || !ready) return;

    const existingSources = calendar.getEventSources();
    existingSources.forEach((s: any) => s.remove());
    calendar.addEventSource(buildCalendarEvents(events));
  }, [events, ready]);

  return (
    <div className="calendar-wrapper">
      <div ref={calendarRef} />
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
        /* Undo Tailwind v4 preflight resets that break FullCalendar */
        .calendar-wrapper table {
          border-collapse: collapse;
        }
        .calendar-wrapper th {
          text-align: inherit;
        }
        .calendar-wrapper button {
          background-color: revert;
          border: revert;
          padding: revert;
          font: revert;
          color: revert;
        }
        .calendar-wrapper .fc-button {
          background-color: var(--fc-button-bg-color);
          border-color: var(--fc-button-border-color);
          color: #fff;
        }
        .calendar-wrapper a {
          color: inherit;
          text-decoration: inherit;
        }
      `}</style>
    </div>
  );
}
