"use client";

import { useMemo, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg } from "@fullcalendar/core";
import type { EventWithSource } from "@/lib/types";
import { toCalendarEvents } from "@/lib/calendar-utils";

interface CalendarViewProps {
  events: EventWithSource[];
  onSelect: (event: EventWithSource) => void;
}

export function CalendarView({ events, onSelect }: CalendarViewProps) {
  const calendarEvents = useMemo(() => toCalendarEvents(events), [events]);

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
