"use client";

import { format } from "date-fns";
import {
  X,
  MapPin,
  Clock,
  ExternalLink,
  Download,
  Mail,
  Tag,
  Users,
  Building,
} from "lucide-react";
import { useState } from "react";
import type { EventWithSource } from "@/lib/types";
import { InviteDialog } from "./InviteDialog";
import { AUDIENCE_TYPES } from "@lecture-seeker/shared";

interface EventDetailProps {
  event: EventWithSource;
  onClose: () => void;
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-lg md:border-l md:border-border md:shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <h2 className="font-semibold truncate pr-4">{event.title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-4">
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt=""
              className="w-full rounded-lg object-cover"
            />
          )}

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                {event.isAllDay
                  ? "All day"
                  : format(new Date(event.startTime), "h:mm a")}
                {event.endTime &&
                  !event.isAllDay &&
                  ` - ${format(new Date(event.endTime), "h:mm a")}`}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{event.location}</p>
                {event.address && (
                  <p className="text-sm text-muted-foreground">
                    {event.address}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Event Type / Audience / Department */}
          <div className="flex flex-wrap gap-2">
            {event.eventType && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary capitalize">
                <Tag className="h-3 w-3" />
                {event.eventType}
              </span>
            )}
            {event.audience && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {AUDIENCE_TYPES[event.audience] || event.audience}
              </span>
            )}
            {event.department && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Building className="h-3 w-3" />
                {event.department}
              </span>
            )}
            {event.cost && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                {event.cost}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Source */}
          <div className="text-xs text-muted-foreground">
            Source: {event.source.name}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="h-4 w-4" />
                View Event
              </a>
            )}

            {event.ticketUrl && event.ticketUrl !== event.url && (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                Register / Tickets
              </a>
            )}

            <a
              href={`/api/events/${event.id}/ics`}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Download .ics
            </a>

            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Mail className="h-4 w-4" />
              Email Invite
            </button>
          </div>
        </div>
      </div>

      {showInvite && (
        <InviteDialog
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowInvite(false)}
        />
      )}
    </>
  );
}
