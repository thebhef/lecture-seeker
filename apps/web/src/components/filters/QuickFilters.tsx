"use client";

import { Moon, Calendar } from "lucide-react";

interface QuickFiltersProps {
  nights: boolean;
  weekends: boolean;
  onNightsChange: (value: boolean) => void;
  onWeekendsChange: (value: boolean) => void;
}

export function QuickFilters({ nights, weekends, onNightsChange, onWeekendsChange }: QuickFiltersProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Quick Filters</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onNightsChange(!nights)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
            nights
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Moon className="h-3.5 w-3.5" />
          Nights
        </button>
        <button
          onClick={() => onWeekendsChange(!weekends)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
            weekends
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Weekends
        </button>
      </div>
    </div>
  );
}
