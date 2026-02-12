"use client";

interface EventTypeFilterProps {
  types: string[];
  selected: string;
  onChange: (value: string) => void;
}

export function EventTypeFilter({ types, selected, onChange }: EventTypeFilterProps) {
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
        {types.map((t) => (
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
      </div>
    </div>
  );
}
