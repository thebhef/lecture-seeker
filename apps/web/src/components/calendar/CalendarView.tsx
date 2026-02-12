"use client";

import { useMemo, useCallback } from "react";
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
};

export function CalendarView({ events, onSelect }: CalendarViewProps) {
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
    (info: EventClickArg) => {
      onSelect(info.event.extendedProps.event as EventWithSource);
    },
    [onSelect]
  );

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
        eventClick={handleEventClick}
        height="auto"
        dayMaxEvents={3}
        nowIndicator={true}
      />
    </div>
  );
}
