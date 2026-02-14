"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Settings, Search, Activity } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/events" className="flex items-center gap-2 font-semibold text-lg">
          <Search className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Lecture Seeker</span>
          <span className="sm:hidden">LS</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/events"
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3 ${
              pathname === "/events"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
          </Link>
          <Link
            href="/sources"
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3 ${
              pathname === "/sources"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Sources</span>
          </Link>
          <Link
            href="/status"
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3 ${
              pathname === "/status"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Status</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
