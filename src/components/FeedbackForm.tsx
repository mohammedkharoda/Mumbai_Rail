"use client";

import { useState, type FormEvent } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const inputClasses =
  "w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm " +
  "text-foreground placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Feedback about the app itself (not a disruption report). */
export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      if (res.status === 201) {
        setMessage("");
        setEmail("");
        setStatus({ kind: "success", message: "Thanks — feedback noted!" });
        return;
      }
      const body = (await res.json()) as { error?: string; retryAfterSec?: number };
      if (res.status === 429) {
        setStatus({
          kind: "error",
          message: `Feedback already sent. Try again in ${body.retryAfterSec ?? 120}s.`,
        });
        return;
      }
      setStatus({
        kind: "error",
        message: body.error ?? `Something went wrong (HTTP ${res.status}).`,
      });
    } catch {
      setStatus({ kind: "error", message: "Network error — are you offline?" });
    }
  }

  return (
    <details className="group rounded-2xl border border-hairline bg-surface shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span>
          <span aria-hidden className="mr-1.5">
            💬
          </span>
          Feedback about this app
        </span>
        <span
          aria-hidden
          className="text-ink-3 motion-safe:transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <form onSubmit={handleSubmit} className="border-t border-hairline p-4">
        <label htmlFor="feedback-message" className="block text-sm font-medium">
          What&apos;s working? What&apos;s missing?
        </label>
        <textarea
          id="feedback-message"
          rows={3}
          required
          minLength={5}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Would love notifications for my home line"
          className={`mt-1.5 resize-y ${inputClasses}`}
        />

        <label htmlFor="feedback-email" className="mt-3 block text-sm font-medium">
          Email <span className="font-normal text-ink-3">(optional, for replies)</span>
        </label>
        <input
          id="feedback-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`mt-1.5 ${inputClasses}`}
        />

        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="mt-4 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-foreground hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors"
        >
          {status.kind === "sending" ? "Sending…" : "Send feedback"}
        </button>

        {status.kind === "success" && (
          <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {status.message}
          </p>
        )}
      </form>
    </details>
  );
}
