"use client";

interface SourceFilterProps {
  sources: { slug: string; name: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
}

export function SourceFilter({ sources, selected, onChange }: SourceFilterProps) {
  const allSelected = selected.length === 0;

  function toggleSource(slug: string) {
    if (allSelected) {
      // Going from "all" to "all except this one"
      onChange(sources.filter((s) => s.slug !== slug).map((s) => s.slug));
    } else if (selected.includes(slug)) {
      const next = selected.filter((s) => s !== slug);
      // If removing the last one, go back to "all"
      onChange(next.length === 0 ? [] : next);
    } else {
      const next = [...selected, slug];
      // If all sources are now selected, clear to mean "all"
      onChange(next.length === sources.length ? [] : next);
    }
  }

  function toggleAll() {
    onChange([]);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Sources</h3>
      <div className="space-y-1">
        <label className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className={allSelected ? "text-primary font-medium" : "text-muted-foreground"}>
            All Sources
          </span>
        </label>
        {sources.map((s) => {
          const isChecked = allSelected || selected.includes(s.slug);
          return (
            <label
              key={s.slug}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSource(s.slug)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className={isChecked && !allSelected ? "text-primary font-medium" : "text-muted-foreground"}>
                {s.name}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
