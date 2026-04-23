/**
 * Google News RSS searcher for the NewsService.
 * Uses the same approach as seed-news.ts but as a runtime searcher.
 * More reliable than DuckDuckGo HTML scraping (no CAPTCHA blocks).
 *
 * IMPORTANT: Google News URLs in the RSS feed are redirect URLs in the format
 *   https://news.google.com/rss/articles/CBMi... (base64-encoded protobuf)
 * The path is case-sensitive — normalizeURL must NOT lowercase the path, only
 * the hostname. Lowercasing `CBMi...` to `cbmi...` breaks the redirect (HTTP 400).
 */
import type { NewsSearcher, SearchResult } from './service.ts';
import type { Logger } from 'pino';

const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (Genie/1.0)';

interface RssItem {
  title: string;
  link: string;
  /** Publisher domain extracted from <source url="..."> */
  sourceDomain: string;
  /** Publisher name extracted from <source>...</source> */
  sourceName: string;
}

function extractItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1] ?? '';
    const title = (body.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/) ?? [])[1]?.trim() ?? '';
    const link = (body.match(/<link>([^<\s]+)/) ?? [])[1]?.trim() ?? '';
    // <source url="https://publisher.com">Publisher Name</source>
    const sourceUrl = (body.match(/<source\s+url="([^"]+)"/) ?? [])[1]?.trim() ?? '';
    const sourceName = (body.match(/<source[^>]*>([^<]+)<\/source>/) ?? [])[1]?.trim() ?? '';
    let sourceDomain = '';
    if (sourceUrl) {
      try { sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
    }
    if (title && link) items.push({ title, link, sourceDomain, sourceName });
  }
  return items;
}

export class GoogleNewsSearcher implements NewsSearcher {
  constructor(private readonly log: Logger) {}

  async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const combined = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    const t0 = Date.now();
    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: combined,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      this.log.warn({ query, status: resp.status }, 'google-news: request failed');
      return [];
    }

    const xml = await resp.text();
    const items = extractItems(xml).slice(0, maxResults);
    this.log.debug({ query, results: items.length, durationMs: Date.now() - t0 }, 'google-news: search done');

    return items.map(i => ({
      title: i.title,
      url: i.link,                                // Google News redirect URL — path is case-sensitive
      snippet: i.sourceName ? `Fonte: ${i.sourceName}` : '',
      sourceDomain: i.sourceDomain || undefined,  // e.g. 'investidor10.com.br'
    }));
  }
}
