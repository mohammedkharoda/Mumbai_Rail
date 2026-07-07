import { NextResponse } from "next/server";

import type { NewsFeed, NewsItem } from "@/lib/types";

/*
 * Headlines via Google News RSS — free and keyless (dedicated news APIs all
 * gate production use behind paid keys). Regex parsing instead of an XML
 * library is a v1 shortcut: the feed is flat and stable; swap in a real
 * parser if this ever grows beyond title/link/source/date.
 */
const QUERY =
  '"mumbai local" OR "western railway" OR "central railway" OR "harbour line" mumbai train';
const NEWS_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(
  QUERY,
)}&hl=en-IN&gl=IN&ceid=IN:en`;

const MAX_ITEMS = 8;

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    // At most one upstream call per 30 minutes regardless of client polling.
    const res = await fetch(NEWS_URL, { next: { revalidate: 1800 } });
    if (!res.ok) {
      return NextResponse.json({ error: "News source unavailable" }, { status: 502 });
    }
    const feed: NewsFeed = {
      fetchedAt: new Date().toISOString(),
      items: parseRssItems(await res.text()).slice(0, MAX_ITEMS),
    };
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: "News source unreachable" }, { status: 502 });
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagContent(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!match) return null;
  const inner = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
  return decodeEntities(inner);
}

function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const title = tagContent(block, "title");
    const link = tagContent(block, "link");
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    const pubDate = tagContent(block, "pubDate");
    items.push({
      title,
      link,
      source: tagContent(block, "source") ?? "Google News",
      publishedAt:
        pubDate && !Number.isNaN(Date.parse(pubDate))
          ? new Date(pubDate).toISOString()
          : null,
    });
  }
  return items;
}
