"use client";

import { useMemo, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg } from "@fullcalendar/core";
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
  "cal-academy": "#1a9641",
};

// Stable references — recreating these on every render causes FullCalendar to reinitialize
const PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin];
const HEADER_DESKTOP = { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" };
const HEADER_MOBILE = { left: "prev,next", center: "title", right: "listWeek,dayGridMonth" };

export function CalendarView({ events, onSelect }: CalendarViewProps) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const calendarEvents = useMemo(() => {
    const now = new Date();
    return events.map((event) => {
      const startStr = typeof event.startTime === "string"
        ? event.startTime
        : new Date(event.startTime).toISOString();
      const endStr = event.endTime
        ? typeof event.endTime === "string"
          ? event.endTime
          : new Date(event.endTime).toISOString()
        : undefined;
      const past = new Date(startStr) < now;
      return {
        id: event.id,
        title: event.title,
        start: startStr,
        end: endStr,
        allDay: event.isAllDay,
        backgroundColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
        borderColor: SOURCE_COLORS[event.source.slug] || "#6b7280",
        classNames: past ? ["fc-event-past"] : [],
        extendedProps: { event },
      };
    });
  }, [events]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    onSelectRef.current(info.event.extendedProps.event as EventWithSource);
  }, []);

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={PLUGINS}
        initialView={isMobile ? "listWeek" : "dayGridMonth"}
        headerToolbar={isMobile ? HEADER_MOBILE : HEADER_DESKTOP}
        events={calendarEvents}
        eventClick={handleEventClick}
        height="auto"
        dayMaxEvents={3}
        nowIndicator={true}
      />
    </div>
  );
}
