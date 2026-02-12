"use client";

import { Calendar, List, LayoutGrid } from "lucide-react";

export type ViewMode = "calendar" | "list" | "grid";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const options: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "calendar", icon: <Calendar className="h-4 w-4" />, label: "Calendar" },
    { mode: "list", icon: <List className="h-4 w-4" />, label: "List" },
    { mode: "grid", icon: <LayoutGrid className="h-4 w-4" />, label: "Grid" },
  ];

  return (
    <div className="flex rounded-lg border border-border bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.mode}
          onClick={() => onChange(opt.mode)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === opt.mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={opt.label}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
