"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface EventTypeFilterProps {
  types: string[];
  selected: string;
  onChange: (value: string) => void;
}

const COLLAPSED_COUNT = 8;

export function EventTypeFilter({ types, selected, onChange }: EventTypeFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = types.length > COLLAPSED_COUNT;
  const visibleTypes = expanded ? types : types.slice(0, COLLAPSED_COUNT);

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Event Type</h3>
      <div className="space-y-1">
        <button
          onClick={() => onChange("")}
          className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            !selected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Types
        </button>
        {visibleTypes.map((t) => (
          <button
            key={t}
            onClick={() => onChange(selected === t ? "" : t)}
            className={`block w-full rounded px-2 py-1 text-left text-sm capitalize transition-colors ${
              selected === t
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
        {showToggle && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                {types.length - COLLAPSED_COUNT} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
