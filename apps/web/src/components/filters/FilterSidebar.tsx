"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { SourceFilter } from "./SourceFilter";
import { EventTypeFilter } from "./EventTypeFilter";
import { TimeOfDayFilter } from "./TimeOfDayFilter";
import { X } from "lucide-react";

interface FilterData {
  eventTypes: string[];
  sources: { slug: string; name: string }[];
  locations: string[];
}

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterData | null>(null);

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

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("source") ||
    searchParams.has("eventType") ||
    searchParams.has("timeOfDay") ||
    searchParams.has("location");

  return (
    <aside className="w-64 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <SearchBar
        value={searchParams.get("q") || ""}
        onChange={(v) => updateParam("q", v || null)}
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

      <TimeOfDayFilter
        selected={searchParams.get("timeOfDay") || ""}
        onChange={(v) => updateParam("timeOfDay", v || null)}
      />
    </aside>
  );
}
