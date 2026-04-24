import type { DB } from '../store/db.ts';
import type { Editorial, EditorialArticleRef, EditorialSection, EditorialSlot, EditorialSummary } from './types.ts';
import { parseTickersJson } from '../store/news.ts';

export interface PromptArticle {
  id: number;
  title: string;
  source: string | null;
  category: string | null;
  tickers: string[];
  publishedAt: string | null;
}

interface ArticleRowMin {
  id: number;
  title: string;
  source: string | null;
  category: string | null;
  tickersJson: string;
  publishedAt: string | null;
}

interface EditorialRow {
  id: number;
  slot: string;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  leadTitle: string;
  leadBody: string;
  sectionsJson: string;
  modelUsed: string | null;
  generatedAt: string;
}

const SELECT_COLS = `
  id, slot,
  edition_date as editionDate,
  period_start as periodStart,
  period_end as periodEnd,
  lead_title as leadTitle,
  lead_body as leadBody,
  sections_json as sectionsJson,
  model_used as modelUsed,
  generated_at as generatedAt
`;

function parseSections(raw: string): EditorialSection[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EditorialSection[]) : [];
  } catch {
    return [];
  }
}

function rowToEditorial(row: EditorialRow): Editorial {
  return {
    id: row.id,
    slot: row.slot as EditorialSlot,
    editionDate: row.editionDate,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    leadTitle: row.leadTitle,
    leadBody: row.leadBody,
    sections: parseSections(row.sectionsJson),
    modelUsed: row.modelUsed,
    generatedAt: row.generatedAt,
  };
}

export interface SaveEditorialInput {
  slot: EditorialSlot;
  editionDate: string;
  periodStart: Date;
  periodEnd: Date;
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
  articleIds: number[];
  modelUsed: string;
  tokensUsed: number | null;
}

const SAVE_SQL = `
  INSERT INTO news_editorials
    (slot, edition_date, period_start, period_end, lead_title, lead_body,
     sections_json, article_ids_json, model_used, tokens_used)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(edition_date, slot) DO UPDATE SET
    period_start     = excluded.period_start,
    period_end       = excluded.period_end,
    lead_title       = excluded.lead_title,
    lead_body        = excluded.lead_body,
    sections_json    = excluded.sections_json,
    article_ids_json = excluded.article_ids_json,
    model_used       = excluded.model_used,
    tokens_used      = excluded.tokens_used,
    generated_at     = CURRENT_TIMESTAMP
`;

export function saveEditorial(db: DB, input: SaveEditorialInput): number {
  const result = db.prepare(SAVE_SQL).run(
    input.slot,
    input.editionDate,
    input.periodStart.toISOString(),
    input.periodEnd.toISOString(),
    input.leadTitle,
    input.leadBody,
    JSON.stringify(input.sections),
    JSON.stringify(input.articleIds),
    input.modelUsed,
    input.tokensUsed,
  );
  return Number(result.lastInsertRowid);
}

export function getLatestEditorial(db: DB): Editorial | null {
  const row = db
    .prepare<[], EditorialRow>(
      `SELECT ${SELECT_COLS} FROM news_editorials ORDER BY generated_at DESC, id DESC LIMIT 1`,
    )
    .get();
  return row ? rowToEditorial(row) : null;
}

export function getEditorialById(db: DB, id: number): Editorial | null {
  const row = db
    .prepare<[number], EditorialRow>(`SELECT ${SELECT_COLS} FROM news_editorials WHERE id = ? LIMIT 1`)
    .get(id);
  return row ? rowToEditorial(row) : null;
}

export function listEditorialSummaries(db: DB, limit: number): EditorialSummary[] {
  const rows = db
    .prepare<[number], { id: number; slot: string; editionDate: string; leadTitle: string; generatedAt: string }>(
      `SELECT id, slot, edition_date as editionDate, lead_title as leadTitle, generated_at as generatedAt
       FROM news_editorials
       ORDER BY generated_at DESC, id DESC
       LIMIT ?`,
    )
    .all(limit);
  return rows.map(r => ({
    id: r.id,
    slot: r.slot as EditorialSlot,
    editionDate: r.editionDate,
    leadTitle: r.leadTitle,
    generatedAt: r.generatedAt,
  }));
}

export function fetchArticlesInWindow(db: DB, start: Date, end: Date): PromptArticle[] {
  const rows = db
    .prepare<[string, string], ArticleRowMin>(
      `SELECT id, title, source, category,
              tickers_json as tickersJson,
              published_at as publishedAt
       FROM news_articles
       WHERE fetched_at BETWEEN ? AND ?
       ORDER BY fetched_at DESC`,
    )
    .all(start.toISOString(), end.toISOString());

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    source: r.source,
    category: r.category,
    tickers: parseTickersJson(r.tickersJson),
    publishedAt: r.publishedAt,
  }));
}

interface ArticleByIdRow {
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

export function fetchArticlesByIds(db: DB, ids: number[]): Map<number, EditorialArticleRef> {
  const out = new Map<number, EditorialArticleRef>();
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare<number[], ArticleByIdRow>(
      `SELECT id, url, title, source, summary,
              tickers_json as tickersJson, category,
              published_at as publishedAt, fetched_at as fetchedAt
       FROM news_articles
       WHERE id IN (${placeholders})`,
    )
    .all(...ids);
  for (const row of rows) out.set(row.id, rowToArticle(row));
  return out;
}

function rowToArticle(row: ArticleByIdRow): EditorialArticleRef {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    source: row.source ?? '',
    ...(row.summary ? { summary: row.summary } : {}),
    tickers: parseTickersJson(row.tickersJson),
    ...(row.category ? { category: row.category } : {}),
    ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
    fetchedAt: row.fetchedAt,
  };
}

/** Coleta e deduplica todos os article IDs referenciados pelas seções. */
export function collectArticleIds(sections: { sourceArticleIds: number[] }[]): number[] {
  const ids = new Set<number>();
  for (const sec of sections) {
    for (const id of sec.sourceArticleIds) ids.add(id);
  }
  return [...ids];
}
