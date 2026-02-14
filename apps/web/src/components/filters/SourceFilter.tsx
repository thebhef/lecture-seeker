"use client";

interface SourceFilterProps {
  sources: { slug: string; name: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
}

export function SourceFilter({ sources, selected, onChange }: SourceFilterProps) {
  const allSelected = selected.length === sources.length;

  function toggleSource(slug: string) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(sources.map((s) => s.slug));
    }
  }

  function selectOnly(slug: string) {
    onChange([slug]);
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
          const isChecked = selected.includes(s.slug);
          return (
            <div
              key={s.slug}
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSource(s.slug)}
                  className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <span className={`truncate ${isChecked ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {s.name}
                </span>
              </label>
              <button
                onClick={() => selectOnly(s.slug)}
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
