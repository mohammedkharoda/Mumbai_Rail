"use client";

import { useEffect, useState } from "react";

import { timeAgo } from "@/lib/format";
import type { NewsFeed } from "@/lib/types";

/** Mumbai railway headlines via /api/news (Google News RSS, cached 30 min). */
export default function NewsPanel() {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NewsFeed;
        if (!cancelled) setFeed(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Railway news"
      className="rounded-2xl border border-hairline bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          <span aria-hidden className="mr-1.5">
            📰
          </span>
          In the news
        </h2>
        <span className="text-xs text-ink-3">via Google News</span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-ink-3">News is unavailable right now.</p>
      )}
      {!feed && !error && <p className="mt-2 text-sm text-ink-3">Loading headlines…</p>}
      {feed && feed.items.length === 0 && (
        <p className="mt-2 text-sm text-ink-3">No recent railway news found.</p>
      )}

      {feed && feed.items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {feed.items.slice(0, 6).map((item) => (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <p className="text-[13px] leading-snug font-medium group-hover:underline">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  {item.source}
                  {item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-ink-3">
        Headlines open on their original publishers&apos; sites.
      </p>
    </section>
  );
}
