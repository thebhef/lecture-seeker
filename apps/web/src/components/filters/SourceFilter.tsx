"use client";

interface SourceFilterProps {
  sources: { slug: string; name: string }[];
  selected: string;
  onChange: (value: string) => void;
}

export function SourceFilter({ sources, selected, onChange }: SourceFilterProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Source</h3>
      <div className="space-y-1">
        <button
          onClick={() => onChange("")}
          className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
            !selected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Sources
        </button>
        {sources.map((s) => (
          <button
            key={s.slug}
            onClick={() => onChange(selected === s.slug ? "" : s.slug)}
            className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
              selected === s.slug
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
