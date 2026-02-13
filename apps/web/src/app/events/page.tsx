"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ViewToggle, type ViewMode } from "@/components/layout/ViewToggle";
import { FilterSidebar } from "@/components/filters/FilterSidebar";
import { EventList } from "@/components/events/EventList";
import { EventGrid } from "@/components/events/EventGrid";
import { EventDetail } from "@/components/events/EventDetail";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const CalendarView = dynamic(
  () => import("@/components/calendar/CalendarView").then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);
import { EVENT_QUERY_MAX_LIMIT } from "@lecture-seeker/shared";
import type { EventWithSource } from "@/lib/types";

interface PaginatedResponse {
  data: EventWithSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function EventsContent() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [response, setResponse] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventWithSource | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has("limit")) {
        params.set("limit", viewMode === "calendar" ? String(EVENT_QUERY_MAX_LIMIT) : "50");
      }
      // Default to upcoming events (now through 1 year out) when no date filter is set
      if (!params.has("startAfter") && !params.has("startBefore")) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.set("startAfter", today.toISOString());
        const oneYearOut = new Date(today);
        oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
        params.set("startBefore", oneYearOut.toISOString());
      }
      const res = await fetch(`/api/events?${params.toString()}`);
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const events = response?.data || [];
  const pagination = response?.pagination;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Events</h1>
            {pagination && (
              <p className="text-sm text-muted-foreground">
                {pagination.total} events found
              </p>
            )}
          </div>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex gap-6">
          <FilterSidebar />

          <main className="relative min-w-0 flex-1">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {viewMode === "calendar" ? (
              <CalendarView events={events} onSelect={setSelectedEvent} />
            ) : viewMode === "grid" ? (
              <EventGrid events={events} onSelect={setSelectedEvent} />
            ) : (
              <EventList events={events} onSelect={setSelectedEvent} />
            )}

            {/* Pagination (not shown in calendar mode) */}
            {pagination &&
              pagination.totalPages > 1 &&
              viewMode !== "calendar" && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <a
                    href={`/events?${buildPageParams(searchParams, pagination.page - 1)}`}
                    className={`flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm ${
                      pagination.page <= 1
                        ? "pointer-events-none opacity-50"
                        : "hover:bg-muted"
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </a>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <a
                    href={`/events?${buildPageParams(searchParams, pagination.page + 1)}`}
                    className={`flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm ${
                      pagination.page >= pagination.totalPages
                        ? "pointer-events-none opacity-50"
                        : "hover:bg-muted"
                    }`}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              )}
          </main>
        </div>
      </div>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

function buildPageParams(
  searchParams: URLSearchParams,
  page: number
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return params.toString();
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <EventsContent />
    </Suspense>
  );
}
