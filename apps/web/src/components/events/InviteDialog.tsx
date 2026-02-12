"use client";

import { useState } from "react";
import { X, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface InviteDialogProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export function InviteDialog({ eventId, eventTitle, onClose }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/send-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }

      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
      setStatus("error");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Email Calendar Invite</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Send a calendar invite for <strong>{eventTitle}</strong>
        </p>

        {status === "success" ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">Invite sent successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-sm font-medium"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recipient@example.com"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {status === "error" && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending" || !email}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {status === "sending" ? "Sending..." : "Send Invite"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
