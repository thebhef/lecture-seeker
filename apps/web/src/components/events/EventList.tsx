"use client";

import { format } from "date-fns";
import { MapPin, Clock, ExternalLink, Tag } from "lucide-react";
import type { EventWithSource } from "@/lib/types";

interface EventListProps {
  events: EventWithSource[];
  onSelect: (event: EventWithSource) => void;
}

export function EventList({ events, onSelect }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg">No events found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelect(event)}
          className="flex w-full gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-2 text-primary">
            <span className="text-xs font-medium uppercase">
              {format(new Date(event.startTime), "MMM")}
            </span>
            <span className="text-xl font-bold leading-tight">
              {format(new Date(event.startTime), "d")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate">
              {event.title}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(event.startTime), "h:mm a")}
                {event.endTime &&
                  ` - ${format(new Date(event.endTime), "h:mm a")}`}
              </span>

              {event.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {event.location}
                </span>
              )}

              {event.eventType && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span className="capitalize">{event.eventType}</span>
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {event.source.name}
              </span>
              {event.cost && (
                <span className="text-green-600">{event.cost}</span>
              )}
              {event.url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
