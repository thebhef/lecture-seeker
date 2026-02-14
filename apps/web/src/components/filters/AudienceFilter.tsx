"use client";

import { AUDIENCE_TYPES } from "@lecture-seeker/shared";

interface AudienceFilterProps {
  audiences: string[];
  selected: string;
  onChange: (value: string) => void;
}

export function AudienceFilter({ audiences, selected, onChange }: AudienceFilterProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Audience</h3>
      <div className="space-y-1">
        <button
          onClick={() => onChange("")}
          className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            !selected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Audiences
        </button>
        {audiences.map((a) => (
          <button
            key={a}
            onClick={() => onChange(selected === a ? "" : a)}
            className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
              selected === a
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {AUDIENCE_TYPES[a] || a}
          </button>
        ))}
      </div>
    </div>
  );
}
