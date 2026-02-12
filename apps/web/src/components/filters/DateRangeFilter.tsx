"use client";

import { CalendarDays } from "lucide-react";

interface DateRangeFilterProps {
  startAfter: string;
  startBefore: string;
  onStartAfterChange: (value: string) => void;
  onStartBeforeChange: (value: string) => void;
}

export function DateRangeFilter({
  startAfter,
  startBefore,
  onStartAfterChange,
  onStartBeforeChange,
}: DateRangeFilterProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        Date Range
      </h3>
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input
            type="date"
            value={startAfter}
            onChange={(e) => onStartAfterChange(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input
            type="date"
            value={startBefore}
            onChange={(e) => onStartBeforeChange(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
