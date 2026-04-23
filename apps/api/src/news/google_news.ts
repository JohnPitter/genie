/**
 * Google News RSS searcher for the NewsService.
 * Uses the same approach as seed-news.ts but as a runtime searcher.
 * More reliable than DuckDuckGo HTML scraping (no CAPTCHA blocks).
 */
import type { NewsSearcher, SearchResult } from './service.ts';
import type { Logger } from 'pino';

const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (Genie/1.0)';

function extractItems(xml: string): Array<{ title: string; link: string }> {
  const items: Array<{ title: string; link: string }> = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1] ?? '';
    const title = (body.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/) ?? [])[1]?.trim() ?? '';
    const link = (body.match(/<link>([^<\s]+)/) ?? [])[1]?.trim() ?? '';
    if (title && link) items.push({ title, link });
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

    return items.map(i => ({ title: i.title, url: i.link, snippet: '' }));
  }
}
