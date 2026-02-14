"use client";

import { AUDIENCE_TYPES } from "@lecture-seeker/shared";

interface AudienceFilterProps {
  audiences: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}

export function AudienceFilter({ audiences, selected, onChange }: AudienceFilterProps) {
  const allSelected = selected.length === audiences.length;

  function toggleAudience(audience: string) {
    if (selected.includes(audience)) {
      onChange(selected.filter((a) => a !== audience));
    } else {
      onChange([...selected, audience]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...audiences]);
    }
  }

  function selectOnly(audience: string) {
    onChange([audience]);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Audience</h3>
      <div className="space-y-1">
        <label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className={allSelected ? "text-primary font-medium" : "text-muted-foreground"}>
            All Audiences
          </span>
        </label>
        {audiences.map((a) => {
          const isChecked = selected.includes(a);
          return (
            <div
              key={a}
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleAudience(a)}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className={`truncate ${isChecked ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {AUDIENCE_TYPES[a] || a}
                </span>
              </label>
              <button
                onClick={() => selectOnly(a)}
                className="hidden shrink-0 text-xs text-muted-foreground hover:text-primary group-hover:block"
              >
                only
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
