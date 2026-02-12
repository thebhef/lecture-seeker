"use client";

import { TIME_OF_DAY } from "@lecture-seeker/shared";

interface TimeOfDayFilterProps {
  selected: string;
  onChange: (value: string) => void;
}

export function TimeOfDayFilter({ selected, onChange }: TimeOfDayFilterProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Time of Day</h3>
      <div className="space-y-1">
        <button
          onClick={() => onChange("")}
          className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            !selected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Any Time
        </button>
        {(Object.entries(TIME_OF_DAY) as [string, { label: string }][]).map(
          ([key, { label }]) => (
            <button
              key={key}
              onClick={() => onChange(selected === key ? "" : key)}
              className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                selected === key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
