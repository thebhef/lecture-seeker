"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { Calendar } from "@fullcalendar/core";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<Calendar | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const calendarEvents = useMemo(() => {
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
  }, [events]);

  const handleEventClick = useCallback(
    (info: { event: { extendedProps: Record<string, unknown> } }) => {
      onSelectRef.current(info.event.extendedProps.event as EventWithSource);
    },
    []
  );

  // Initialize calendar once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calendar = new Calendar(el, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,listWeek",
      },
      eventClick: handleEventClick,
      height: "auto",
      dayMaxEvents: 3,
      nowIndicator: true,
    });

    calendar.render();
    calendarRef.current = calendar;

    return () => {
      calendar.destroy();
      calendarRef.current = null;
    };
  }, [handleEventClick]);

  // Update events whenever they change
  useEffect(() => {
    const cal = calendarRef.current;
    if (!cal) return;

    cal.removeAllEventSources();
    cal.addEventSource(calendarEvents);
  }, [calendarEvents]);

  return <div ref={containerRef} className="calendar-wrapper" />;
}
