"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import {
  RefreshCw,
  Clock,
  Database,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SourceStatus {
  id: string;
  name: string;
  slug: string;
  type: string;
  url: string;
  enabled: boolean;
  isBuiltIn: boolean;
  lastScrapedAt: string | null;
  lastError: string | null;
  lastScrapeEvents: number;
  lastScrapeNew: number;
  lastScrapeDuration: number | null;
  totalEvents: number;
  earliestEvent: string | null;
  latestEvent: string | null;
  _count: { events: number };
}

export default function StatusPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sources", { cache: "no-store" });
      const json = await res.json();
      setSources(json.data || []);
    } catch {
      // ignore
    }
  };

  const triggerScrape = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      if (res.ok) {
        // Poll for updates while scrape is running
        const poll = setInterval(fetchStatus, 3000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(poll), 5 * 60 * 1000);
      }
    } catch {
      // ignore
    }
    await fetchStatus();
    setLoading(false);
  };

  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !currentEnabled }),
    });
    fetchStatus();
  };

  const clearSourceEvents = async (sourceId: string) => {
    if (!confirm("Clear all events for this source? They will be re-populated on the next scrape.")) return;
    await fetch(`/api/sources/${sourceId}/events`, { method: "DELETE" });
    fetchStatus();
  };

  const clearAllEvents = async () => {
    if (!confirm("Clear ALL events from ALL sources? They will be re-populated on the next scrape.")) return;
    await fetch("/api/events/clear", { method: "DELETE" });
    fetchStatus();
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalEvents = sources.reduce((sum, s) => sum + (s._count?.events ?? 0), 0);
  const lastScrape = sources
    .filter((s) => s.lastScrapedAt)
    .sort(
      (a, b) =>
        new Date(b.lastScrapedAt!).getTime() -
        new Date(a.lastScrapedAt!).getTime()
    )[0]?.lastScrapedAt;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Scrape Status</h1>
            <p className="text-sm text-muted-foreground">
              Data freshness and scraper health
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAllEvents}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
            <button
              onClick={triggerScrape}
              disabled={loading}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Scrape Now
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              Total Events
            </div>
            <p className="mt-1 text-3xl font-bold">{totalEvents.toLocaleString()}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Active Sources
            </div>
            <p className="mt-1 text-3xl font-bold">
              {sources.filter((s) => s.enabled).length}
              <span className="text-lg text-muted-foreground">
                {" "}/ {sources.length}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last Scrape
            </div>
            <p className="mt-1 text-lg font-semibold">
              {lastScrape
                ? formatDistanceToNow(new Date(lastScrape), {
                    addSuffix: true,
                  })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Per-source status */}
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`rounded-lg border bg-card p-4 ${
                source.lastError
                  ? "border-red-300 dark:border-red-800"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {source.lastError ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    ) : source.lastScrapedAt ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">{source.name}</h3>
                    {!source.enabled && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Disabled
                      </span>
                    )}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {source.type.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {source.url}
                  </p>

                  {source.lastError && (
                    <p className="mt-2 text-xs text-red-500">
                      Error: {source.lastError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => clearSourceEvents(source.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Clear events for this source"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleEnabled(source.id, source.enabled)}
                    className="rounded-md p-1.5 hover:bg-muted"
                    title={source.enabled ? "Disable source" : "Enable source"}
                  >
                    {source.enabled ? (
                      <ToggleRight className="h-6 w-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Last Scraped</p>
                  <p className="text-sm font-medium">
                    {source.lastScrapedAt
                      ? formatDistanceToNow(new Date(source.lastScrapedAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Events Found
                  </p>
                  <p className="text-sm font-medium">
                    {source.lastScrapeEvents.toLocaleString()}
                    {source.lastScrapeNew > 0 && (
                      <span className="text-green-600 ml-1">
                        (+{source.lastScrapeNew} new)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total in DB</p>
                  <p className="text-sm font-medium">
                    {(source._count?.events ?? source.totalEvents).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">
                    {source.lastScrapeDuration != null
                      ? `${source.lastScrapeDuration}s`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Earliest Event</p>
                  <p className="text-sm font-medium">
                    {source.earliestEvent
                      ? format(new Date(source.earliestEvent), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Latest Event</p>
                  <p className="text-sm font-medium">
                    {source.latestEvent
                      ? format(new Date(source.latestEvent), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
