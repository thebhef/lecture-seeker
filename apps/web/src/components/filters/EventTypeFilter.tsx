"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EVENT_TYPES } from "@lecture-seeker/shared";

interface EventTypeFilterProps {
  types: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}

const COLLAPSED_COUNT = 8;

export function EventTypeFilter({ types, selected, onChange }: EventTypeFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = types.length > COLLAPSED_COUNT;
  const visibleTypes = expanded ? types : types.slice(0, COLLAPSED_COUNT);
  const allSelected = selected.length === types.length;

  function toggleType(type: string) {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...types]);
    }
  }

  function selectOnly(type: string) {
    onChange([type]);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Event Type</h3>
      <div className="space-y-1">
        <label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className={allSelected ? "text-primary font-medium" : "text-muted-foreground"}>
            All Types
          </span>
        </label>
        {visibleTypes.map((t) => {
          const isChecked = selected.includes(t);
          return (
            <div
              key={t}
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleType(t)}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className={`truncate ${isChecked ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {EVENT_TYPES[t] || t}
                </span>
              </label>
              <button
                onClick={() => selectOnly(t)}
                className="hidden shrink-0 text-xs text-muted-foreground hover:text-primary group-hover:block"
              >
                only
              </button>
            </div>
          );
        })}
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
