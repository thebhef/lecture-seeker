"use client";

import { format } from "date-fns";
import { MapPin, Clock, ExternalLink } from "lucide-react";
import type { EventWithSource } from "@/lib/types";

interface EventGridProps {
  events: EventWithSource[];
  onSelect: (event: EventWithSource) => void;
}

export function EventGrid({ events, onSelect }: EventGridProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg">No events found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelect(event)}
          className="flex flex-col rounded-lg border border-border bg-card text-left transition-shadow hover:shadow-md"
        >
          {event.imageUrl && (
            <div className="relative h-36 w-full overflow-hidden rounded-t-lg bg-muted">
              <img
                src={event.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm leading-snug line-clamp-2">
                {event.title}
              </h3>
            </div>

            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {format(new Date(event.startTime), "MMM d, h:mm a")}
              </div>

              {event.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </div>

            <div className="mt-auto flex items-center gap-2 pt-3 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {event.source.name}
              </span>
              {event.eventType && (
                <span className="capitalize text-muted-foreground">
                  {event.eventType}
                </span>
              )}
              {event.cost && (
                <span className="ml-auto text-green-600">{event.cost}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
