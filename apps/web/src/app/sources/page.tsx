"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import {
  Globe,
  ToggleLeft,
  ToggleRight,
  Trash2,
  RefreshCw,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface SourceData {
  id: string;
  name: string;
  slug: string;
  type: string;
  url: string;
  enabled: boolean;
  isBuiltIn: boolean;
  lastScrapedAt: string | null;
  lastError: string | null;
  _count: { events: number };
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState("");

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(data.data);
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchSources();
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Delete this source and all its events?")) return;
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    fetchSources();
  };

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, url: newUrl, type: "ICS_FEED" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Failed to add source");
      return;
    }

    setNewName("");
    setNewUrl("");
    setShowAddForm(false);
    fetchSources();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Event Sources</h1>
            <p className="text-sm text-muted-foreground">
              Manage where events are scraped from
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Source
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-medium">Add ICS Feed Source</h3>
            <form onSubmit={addSource} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My University Events"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  ICS Feed URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.edu/calendar.ics"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {addError && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {addError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Add Source
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h3 className="font-medium">{source.name}</h3>
                      {source.isBuiltIn && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          Built-in
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {source.url}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{source._count.events} events</span>
                      <span className="capitalize">{source.type.replace("_", " ").toLowerCase()}</span>

                      {source.lastScrapedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last scraped:{" "}
                          {format(
                            new Date(source.lastScrapedAt),
                            "MMM d, h:mm a"
                          )}
                        </span>
                      )}

                      {source.lastError ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Error
                        </span>
                      ) : source.lastScrapedAt ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          OK
                        </span>
                      ) : null}
                    </div>

                    {source.lastError && (
                      <p className="mt-1 text-xs text-destructive line-clamp-2">
                        {source.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleEnabled(source.id, source.enabled)}
                      className="rounded-md p-1.5 hover:bg-muted"
                      title={source.enabled ? "Disable" : "Enable"}
                    >
                      {source.enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {!source.isBuiltIn && (
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
