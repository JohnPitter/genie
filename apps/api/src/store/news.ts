import type { DB } from './db.ts';

export interface Article {
  id?: number;
  url: string;
  title: string;
  source?: string;
  summary?: string;
  tickers: string[];
  category?: string;
  publishedAt?: string;
  fetchedAt: string;
}

interface ArticleRow {
  id: number;
  url: string;
  title: string;
  source: string | null;
  summary: string | null;
  tickersJson: string;
  category: string | null;
  publishedAt: string | null;
  fetchedAt: string;
}

export function parseTickersJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeURL(u: string): string {
  const trimmed = u.trim().replace(/\/$/, '');
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed.toLowerCase();
  }
}

function rowToArticle(row: ArticleRow): Article {
  const tickers = parseTickersJson(row.tickersJson);
  const article: Article = {
    id: row.id,
    url: row.url,
    title: row.title,
    tickers,
    fetchedAt: row.fetchedAt,
  };
  if (row.source !== null) article.source = row.source;
  if (row.summary !== null) article.summary = row.summary;
  if (row.category !== null) article.category = row.category;
  if (row.publishedAt !== null) article.publishedAt = row.publishedAt;
  return article;
}

const UPSERT_SQL = `
  INSERT INTO news_articles (url, title, source, summary, tickers_json, category, published_at, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(url) DO UPDATE SET
    tickers_json = excluded.tickers_json,
    summary      = excluded.summary,
    category     = excluded.category,
    fetched_at   = excluded.fetched_at
`;

export function upsertArticles(db: DB, articles: Article[]): void {
  if (articles.length === 0) return;
  const stmt = db.prepare(UPSERT_SQL);
  const run = db.transaction((items: Article[]) => {
    for (const a of items) {
      const url = normalizeURL(a.url);
      const tickersJson = JSON.stringify(a.tickers.map(t => t.toUpperCase()));
      stmt.run(
        url,
        a.title,
        a.source ?? null,
        a.summary ?? null,
        tickersJson,
        a.category ?? null,
        a.publishedAt ?? null,
        a.fetchedAt,
      );
    }
  });
  run(articles);
}

const SELECT_COLS = `
  id, url, title, source, summary,
  tickers_json as tickersJson, category,
  published_at as publishedAt, fetched_at as fetchedAt
`;

export function listByTicker(db: DB, ticker: string, limit: number): Article[] {
  const rows = db
    .prepare<[string, number], ArticleRow>(
      `SELECT a.${SELECT_COLS.trim()}
       FROM news_articles a, json_each(a.tickers_json) t
       WHERE t.value = ?
       ORDER BY a.fetched_at DESC
       LIMIT ?`,
    )
    .all(ticker.toUpperCase(), limit);
  return rows.map(rowToArticle);
}

export function listByCategory(db: DB, category: string, limit: number): Article[] {
  const rows = db
    .prepare<[string, number], ArticleRow>(
      `SELECT ${SELECT_COLS}
       FROM news_articles
       WHERE category = ?
       ORDER BY fetched_at DESC
       LIMIT ?`,
    )
    .all(category, limit);
  return rows.map(rowToArticle);
}

export function listRecent(db: DB, since: string, limit: number): Article[] {
  const rows = db
    .prepare<[string, number], ArticleRow>(
      `SELECT ${SELECT_COLS}
       FROM news_articles
       WHERE fetched_at > ?
       ORDER BY fetched_at DESC
       LIMIT ?`,
    )
    .all(since, limit);
  return rows.map(rowToArticle);
}

export function pruneArticles(db: DB, olderThanMs: number): number {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const result = db.prepare('DELETE FROM news_articles WHERE fetched_at < ?').run(cutoff);
  return result.changes;
}
