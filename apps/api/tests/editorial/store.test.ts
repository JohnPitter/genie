import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchArticlesByIds,
  fetchArticlesInWindow,
  getEditorialById,
  getLatestEditorial,
  listEditorialSummaries,
  saveEditorial,
} from '../../src/editorial/store.ts';

function openTestDb(): Database.Database {
  const db = new Database(':memory:');
  const dir = join(process.cwd(), 'src/store/migrations');
  for (const f of [
    '001_init.sql',
    '002_news_articles.sql',
    '003_predictions.sql',
    '004_news_editorials.sql',
  ]) {
    db.exec(readFileSync(join(dir, f), 'utf-8'));
  }
  return db;
}

function insertArticle(
  db: Database.Database,
  url: string,
  title: string,
  category: string,
  tickers: string[],
  fetchedAt: Date,
): number {
  const r = db
    .prepare(
      `INSERT INTO news_articles (url, title, source, summary, tickers_json, category, published_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(url, title, 'src.com', 'sumário', JSON.stringify(tickers), category, null, fetchedAt.toISOString());
  return Number(r.lastInsertRowid);
}

describe('editorial/store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openTestDb();
  });

  describe('fetchArticlesInWindow', () => {
    it('returns only articles inside [start, end]', () => {
      insertArticle(db, 'https://a/1', 'Old', 'energia', ['PETR4'], new Date('2026-04-24T05:00:00Z'));
      insertArticle(db, 'https://a/2', 'In', 'energia', ['PETR4'], new Date('2026-04-24T15:00:00Z'));
      insertArticle(db, 'https://a/3', 'Future', 'energia', ['PETR4'], new Date('2026-04-25T00:00:00Z'));

      const start = new Date('2026-04-24T14:00:00Z');
      const end = new Date('2026-04-24T20:00:00Z');
      const out = fetchArticlesInWindow(db, start, end);
      expect(out).toHaveLength(1);
      expect(out[0]!.title).toBe('In');
      expect(out[0]!.tickers).toEqual(['PETR4']);
    });

    it('handles malformed tickers_json gracefully', () => {
      db.prepare(
        `INSERT INTO news_articles (url, title, tickers_json, fetched_at) VALUES (?, ?, ?, ?)`,
      ).run('https://b/1', 'Bad', 'not-json', new Date().toISOString());
      const out = fetchArticlesInWindow(db, new Date(0), new Date());
      expect(out[0]!.tickers).toEqual([]);
    });
  });

  describe('saveEditorial / getLatestEditorial / getEditorialById', () => {
    it('persists and reads back round-trip', () => {
      const id = saveEditorial(db, {
        slot: '12',
        editionDate: '2026-04-24',
        periodStart: new Date('2026-04-24T11:00:00Z'),
        periodEnd: new Date('2026-04-24T15:00:00Z'),
        leadTitle: 'Manchete',
        leadBody: 'Corpo do lead.',
        sections: [
          {
            category: 'energia',
            title: 'Energia',
            body: 'Análise.',
            highlightTickers: ['PETR4'],
            sourceArticleIds: [1, 2],
          },
        ],
        articleIds: [1, 2],
        modelUsed: 'anthropic/claude-3.5-haiku',
        tokensUsed: 1200,
      });
      expect(id).toBeGreaterThan(0);

      const latest = getLatestEditorial(db);
      expect(latest).not.toBeNull();
      expect(latest!.slot).toBe('12');
      expect(latest!.leadTitle).toBe('Manchete');
      expect(latest!.sections).toHaveLength(1);
      expect(latest!.sections[0]!.highlightTickers).toEqual(['PETR4']);

      const byId = getEditorialById(db, id);
      expect(byId?.id).toBe(id);
    });

    it('upserts on conflict (edition_date, slot)', () => {
      const base = {
        slot: '12' as const,
        editionDate: '2026-04-24',
        periodStart: new Date('2026-04-24T11:00:00Z'),
        periodEnd: new Date('2026-04-24T15:00:00Z'),
        articleIds: [],
        modelUsed: 'm',
        tokensUsed: null,
      };
      saveEditorial(db, {
        ...base,
        leadTitle: 'Primeira',
        leadBody: 'A',
        sections: [{ category: 'varejo', title: 't', body: 'b', highlightTickers: [], sourceArticleIds: [] }],
      });
      saveEditorial(db, {
        ...base,
        leadTitle: 'Segunda',
        leadBody: 'B',
        sections: [{ category: 'energia', title: 't', body: 'b', highlightTickers: [], sourceArticleIds: [] }],
      });
      const latest = getLatestEditorial(db);
      expect(latest!.leadTitle).toBe('Segunda');
      const all = listEditorialSummaries(db, 10);
      expect(all).toHaveLength(1);
    });

    it('listEditorialSummaries orders by generated_at DESC', () => {
      const mk = (slot: '08' | '12' | '16' | '20', date: string, lead: string) =>
        saveEditorial(db, {
          slot,
          editionDate: date,
          periodStart: new Date(),
          periodEnd: new Date(),
          leadTitle: lead,
          leadBody: 'b',
          sections: [{ category: 'varejo', title: 't', body: 'b', highlightTickers: [], sourceArticleIds: [] }],
          articleIds: [],
          modelUsed: 'm',
          tokensUsed: null,
        });
      mk('08', '2026-04-24', 'Manhã');
      mk('12', '2026-04-24', 'Meio-dia');
      mk('16', '2026-04-24', 'Tarde');

      const list = listEditorialSummaries(db, 10);
      expect(list).toHaveLength(3);
      expect(list[0]!.leadTitle).toBe('Tarde');
    });
  });

  describe('fetchArticlesByIds', () => {
    it('returns map keyed by id with parsed tickers', () => {
      const id1 = insertArticle(db, 'https://x/1', 'A', 'energia', ['PETR4'], new Date());
      const id2 = insertArticle(db, 'https://x/2', 'B', 'varejo', ['MGLU3'], new Date());
      const map = fetchArticlesByIds(db, [id1, id2, 999]);
      expect(map.size).toBe(2);
      expect(map.get(id1)!.title).toBe('A');
      expect(map.get(id2)!.tickers).toEqual(['MGLU3']);
    });

    it('returns empty map for empty input', () => {
      expect(fetchArticlesByIds(db, []).size).toBe(0);
    });
  });
});
