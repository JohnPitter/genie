import { TTLCache } from '../b3/cache.ts';
import { tickersFor, categoryOf } from '../b3/categories.ts';
import type { Category } from '../b3/categories.ts';
import { listByCategory, listByTicker, upsertArticles } from '../store/news.ts';
import type { Article } from '../store/news.ts';
import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';

export type { Article };

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Publisher domain (e.g. 'investidor10.com.br') — when provided, used instead
   * of extracting from the URL (which would give 'news.google.com' for redirects). */
  sourceDomain?: string;
}

export interface NewsSearcher {
  search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResult[]>;
}

const DEFAULT_CATEGORY_TTL_MS = 5 * 60_000;
const DEFAULT_TICKER_TTL_MS = 5 * 60_000;
const DEFAULT_RESULT_LIMIT = 20;
const CATEGORY_TOP_TICKERS = 15;
const CATEGORY_ARTICLES_PER_TICK = 3;
const DEFAULT_SEARCH_LIMIT = 5;
const DB_FRESHNESS_WINDOW_MS = 2 * 60 * 60_000; // 2 hours

function normalizeURL(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  try {
    // Only lowercase the hostname — the path may contain case-sensitive base64
    // (e.g. Google News redirect URLs: news.google.com/rss/articles/CBMi...)
    const u = new URL(trimmed);
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, '');
  } catch {
    return trimmed.toLowerCase();
  }
}

function extractDomain(raw: string): string {
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function filterLimit<T>(arr: T[], limit: number): T[] {
  return arr.length <= limit ? arr : arr.slice(0, limit);
}

export interface ServiceOptions {
  categoryTtlMs?: number;
  tickerTtlMs?: number;
}

export class NewsService {
  private readonly cache = new TTLCache<Article[]>();
  private readonly categoryTtlMs: number;
  private readonly tickerTtlMs: number;

  constructor(
    private readonly db: DB,
    private readonly searcher: NewsSearcher,
    private readonly log: Logger,
    opts: ServiceOptions = {},
  ) {
    this.categoryTtlMs = opts.categoryTtlMs ?? DEFAULT_CATEGORY_TTL_MS;
    this.tickerTtlMs = opts.tickerTtlMs ?? DEFAULT_TICKER_TTL_MS;
  }

  async byCategory(cat: string, limit = DEFAULT_RESULT_LIMIT, signal?: AbortSignal): Promise<Article[]> {
    const key = `news:cat:${cat}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.log.debug({ category: cat }, 'news cache hit (category)');
      return filterLimit(cached, limit);
    }

    const dbRows = listByCategory(this.db, cat, limit * 3);
    if (dbRows.length > 0 && isFresh(dbRows[0]!.fetchedAt)) {
      this.log.debug({ category: cat, count: dbRows.length }, 'news db hit (category)');
      this.cache.set(key, dbRows, this.categoryTtlMs);
      return filterLimit(dbRows, limit);
    }

    this.log.info({ category: cat }, 'news db miss — searching category');
    let tickers = tickersFor(cat as Category);
    if (tickers.length > CATEGORY_TOP_TICKERS) tickers = tickers.slice(0, CATEGORY_TOP_TICKERS);

    const articles = await this.searchForTickersN(tickers, cat, CATEGORY_ARTICLES_PER_TICK, signal);
    this.persistQuiet(articles);
    this.cache.set(key, articles, this.categoryTtlMs);
    return filterLimit(articles, limit);
  }

  async byTicker(ticker: string, limit = DEFAULT_RESULT_LIMIT, signal?: AbortSignal): Promise<Article[]> {
    ticker = ticker.toUpperCase().trim();
    if (!ticker) throw new Error('news.byTicker: ticker must not be empty');

    const key = `news:ticker:${ticker}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.log.debug({ ticker }, 'news cache hit (ticker)');
      return filterLimit(cached, limit);
    }

    const dbRows = listByTicker(this.db, ticker, limit);
    if (dbRows.length > 0 && isFresh(dbRows[0]!.fetchedAt)) {
      this.log.debug({ ticker, count: dbRows.length }, 'news db hit (ticker)');
      this.cache.set(key, dbRows, this.tickerTtlMs);
      return filterLimit(dbRows, limit);
    }

    this.log.info({ ticker }, 'news db miss — searching ticker');
    const cat = categoryOf(ticker) ?? '';
    const articles = await this.searchForTickers([ticker], cat, signal);
    this.persistQuiet(articles);
    this.cache.set(key, articles, this.tickerTtlMs);
    return filterLimit(articles, limit);
  }

  async refreshTickers(tickers: string[], signal?: AbortSignal): Promise<{ fetched: number; firstError: Error | null }> {
    let fetched = 0;
    let firstError: Error | null = null;

    for (const ticker of tickers) {
      try {
        const articles = await this.searchForTickerSingle(ticker, signal);
        upsertArticles(this.db, articles);
        this.cache.delete(`news:ticker:${ticker}`);
        fetched += articles.length;
        this.log.info({ ticker, count: articles.length }, 'news: ticker refreshed');
      } catch (err) {
        this.log.error({ ticker, err }, 'news: refresh failed');
        if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
      }
    }

    return { fetched, firstError };
  }

  async refreshCategory(cat: string, signal?: AbortSignal): Promise<number> {
    let tickers = tickersFor(cat as Category);
    if (tickers.length > CATEGORY_TOP_TICKERS) tickers = tickers.slice(0, CATEGORY_TOP_TICKERS);
    if (!tickers.length) return 0;

    const articles = await this.searchForTickersN(tickers, cat, CATEGORY_ARTICLES_PER_TICK, signal);
    this.persistQuiet(articles);
    this.cache.delete(`news:cat:${cat}`);
    this.log.info({ category: cat, articles: articles.length }, 'news: category refreshed');
    return articles.length;
  }

  stop(): void {
    this.cache.stop();
  }

  private async searchForTickerSingle(ticker: string, signal?: AbortSignal): Promise<Article[]> {
    const cat = categoryOf(ticker) ?? '';
    const year = new Date().getFullYear();
    const query = `${ticker} notícias B3 ${year} OR ${year - 1}`;
    const results = await this.searcher.search(query, DEFAULT_SEARCH_LIMIT, signal);

    const seen = new Set<string>();
    const articles: Article[] = [];
    for (const r of results) {
      const url = normalizeURL(r.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      articles.push({
        url,
        title: r.title,
        source: r.sourceDomain || extractDomain(r.url),
        summary: r.snippet,
        tickers: [ticker],
        ...(cat ? { category: cat } : {}),
        fetchedAt: new Date().toISOString(),
      });
    }
    return articles;
  }

  private async searchForTickers(tickers: string[], cat: string, signal?: AbortSignal): Promise<Article[]> {
    return this.searchForTickersN(tickers, cat, DEFAULT_SEARCH_LIMIT, signal);
  }

  private async searchForTickersN(
    tickers: string[],
    cat: string,
    perTicker: number,
    signal?: AbortSignal,
  ): Promise<Article[]> {
    const perResults = await Promise.all(
      tickers.map(async ticker => {
        const year = new Date().getFullYear();
        const query = `${ticker} notícias B3 ${year} OR ${year - 1}`;
        try {
          const hits = await this.searcher.search(query, perTicker, signal);
          this.log.debug({ ticker, results: hits.length }, 'news: search done');
          const out: Article[] = [];
          for (const r of hits.slice(0, perTicker)) {
            const url = normalizeURL(r.url);
            if (!url) continue;
            out.push({
              url,
              title: r.title,
              source: r.sourceDomain || extractDomain(r.url),
              summary: r.snippet,
              tickers: [ticker],
              ...(cat ? { category: cat } : {}),
              fetchedAt: new Date().toISOString(),
            });
          }
          return out;
        } catch (err) {
          this.log.warn({ ticker, err }, 'news: search failed (skipping)');
          return [];
        }
      }),
    );

    const seen = new Set<string>();
    const articles: Article[] = [];
    for (const batch of perResults) {
      for (const a of batch) {
        if (!seen.has(a.url)) {
          seen.add(a.url);
          articles.push(a);
        }
      }
    }
    return articles;
  }

  private persistQuiet(articles: Article[]): void {
    try {
      upsertArticles(this.db, articles);
    } catch (err) {
      this.log.warn({ err }, 'news: upsert failed (non-fatal)');
    }
  }
}

function isFresh(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < DB_FRESHNESS_WINDOW_MS;
}
