"use client";

import { AGE_GROUP_TYPES } from "@lecture-seeker/shared";

interface AgeGroupFilterProps {
  ageGroups: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}

export function AgeGroupFilter({ ageGroups, selected, onChange }: AgeGroupFilterProps) {
  const allSelected = selected.length === ageGroups.length;

  function toggleAgeGroup(ageGroup: string) {
    if (selected.includes(ageGroup)) {
      onChange(selected.filter((a) => a !== ageGroup));
    } else {
      onChange([...selected, ageGroup]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...ageGroups]);
    }
  }

  function selectOnly(ageGroup: string) {
    onChange([ageGroup]);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Age Group</h3>
      <div className="space-y-1">
        <label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className={allSelected ? "text-primary font-medium" : "text-muted-foreground"}>
            All Age Groups
          </span>
        </label>
        {ageGroups.map((ag) => {
          const isChecked = selected.includes(ag);
          return (
            <div
              key={ag}
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleAgeGroup(ag)}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className={`truncate ${isChecked ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {AGE_GROUP_TYPES[ag] || ag}
                </span>
              </label>
              <button
                onClick={() => selectOnly(ag)}
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
