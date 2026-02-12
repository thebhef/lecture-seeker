"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Settings, Search } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/events" className="flex items-center gap-2 font-semibold text-lg">
          <Search className="h-5 w-5 text-primary" />
          Lecture Seeker
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/events"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === "/events"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Events
          </Link>
          <Link
            href="/sources"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === "/sources"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="h-4 w-4" />
            Sources
          </Link>
        </nav>
      </div>
    </header>
  );
}
