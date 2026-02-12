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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  _count: { events: number };
}

export default function StatusPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources");
      const json = await res.json();
      setSources(json.data || []);
    } catch {
      // ignore
    }
    setLoading(false);
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
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
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
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
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
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Events</p>
                  <p className="text-sm font-medium">
                    {source.lastScrapeNew > 0 ? (
                      <span className="text-green-600">
                        +{source.lastScrapeNew}
                      </span>
                    ) : (
                      source.lastScrapeNew
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
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
