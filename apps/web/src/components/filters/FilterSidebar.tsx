"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { SourceFilter } from "./SourceFilter";
import { EventTypeFilter } from "./EventTypeFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { QuickFilters } from "./QuickFilters";
import { X, SlidersHorizontal } from "lucide-react";
import { DEFAULT_START_HOUR } from "@lecture-seeker/shared";

interface FilterData {
  eventTypes: string[];
  sources: { slug: string; name: string }[];
  locations: string[];
}

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then(setFilters)
      .catch(console.error);
  }, []);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/events?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push("/events");
  }, [router]);

  // Compute default datetimes: today at 18:00 -> 1 year out at 23:59
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const oneYearOut = new Date(today);
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  const oneYearStr = `${oneYearOut.getFullYear()}-${String(oneYearOut.getMonth() + 1).padStart(2, "0")}-${String(oneYearOut.getDate()).padStart(2, "0")}`;
  const defaultStartAfter = `${todayStr}T${String(DEFAULT_START_HOUR).padStart(2, "0")}:00`;
  const defaultStartBefore = `${oneYearStr}T23:59`;

  // Convert ISO/UTC params to local YYYY-MM-DDTHH:MM for input[type=datetime-local]
  function toLocalDatetimeStr(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${day}T${h}:${mi}`;
  }

  const startAfterParam = searchParams.get("startAfter") || "";
  const startBeforeParam = searchParams.get("startBefore") || "";
  const startAfterDate = startAfterParam ? toLocalDatetimeStr(startAfterParam) : defaultStartAfter;
  const startBeforeDate = startBeforeParam ? toLocalDatetimeStr(startBeforeParam) : defaultStartBefore;

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("source") ||
    searchParams.has("eventType") ||
    searchParams.has("location") ||
    searchParams.has("startAfter") ||
    searchParams.has("startBefore") ||
    searchParams.has("nights") ||
    searchParams.has("weekends");

  const activeFilterCount = [
    searchParams.get("q"),
    searchParams.get("source"),
    searchParams.get("eventType"),
    searchParams.get("startAfter"),
    searchParams.get("startBefore"),
    searchParams.get("nights"),
    searchParams.get("weekends"),
  ].filter(Boolean).length;

  const filterContent = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          {/* Close button visible only on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 hover:bg-muted md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <SearchBar
        value={searchParams.get("q") || ""}
        onChange={(v) => updateParam("q", v || null)}
      />

      <QuickFilters
        nights={searchParams.get("nights") === "true"}
        weekends={searchParams.get("weekends") === "true"}
        onNightsChange={(v) => updateParam("nights", v ? "true" : null)}
        onWeekendsChange={(v) => updateParam("weekends", v ? "true" : null)}
      />

      <DateRangeFilter
        startAfter={startAfterDate}
        startBefore={startBeforeDate}
        onStartAfterChange={(v) =>
          updateParam("startAfter", v ? new Date(v).toISOString() : null)
        }
        onStartBeforeChange={(v) =>
          updateParam("startBefore", v ? new Date(v).toISOString() : null)
        }
      />

      {filters && (
        <>
          <SourceFilter
            sources={filters.sources}
            selected={searchParams.get("source") || ""}
            onChange={(v) => updateParam("source", v || null)}
          />

          <EventTypeFilter
            types={filters.eventTypes}
            selected={searchParams.get("eventType") || ""}
            onChange={(v) => updateParam("eventType", v || null)}
          />
        </>
      )}

    </>
  );

  return (
    <>
      {/* Mobile filter toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-background p-4 shadow-xl space-y-5 md:hidden">
            {filterContent}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 space-y-5 md:block">
        {filterContent}
      </aside>
    </>
  );
}
