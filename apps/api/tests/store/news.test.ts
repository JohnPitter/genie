import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDB } from './helpers.ts';
import {
  upsertArticles,
  listByTicker,
  listByCategory,
  listRecent,
  pruneArticles,
  type Article,
} from '../../src/store/news.ts';
import type { DB } from '../../src/store/db.ts';

let db: DB;

beforeEach(() => {
  db = openTestDB();
});

function makeArticle(url: string, title: string, ticker: string, category: string): Article {
  return {
    url,
    title,
    source: 'infomoney.com.br',
    summary: 'Resumo de teste',
    tickers: [ticker],
    category,
    fetchedAt: new Date().toISOString(),
  };
}

describe('upsertArticles', () => {
  it('inserts a single article and retrieves it by ticker', () => {
    upsertArticles(db, [makeArticle('https://infomoney.com.br/petr4', 'PETR4 alta', 'PETR4', 'commodities')]);
    const articles = listByTicker(db, 'PETR4', 10);
    expect(articles).toHaveLength(1);
    expect(articles[0]?.title).toBe('PETR4 alta');
  });

  it('is a no-op for empty array', () => {
    expect(() => upsertArticles(db, [])).not.toThrow();
    expect(listByTicker(db, 'PETR4', 10)).toHaveLength(0);
  });

  it('is idempotent — same URL does not create duplicate', () => {
    const a = makeArticle('https://b.com/same', 'Article', 'VALE3', 'commodities');
    upsertArticles(db, [a]);
    upsertArticles(db, [a]);
    expect(listByTicker(db, 'VALE3', 10)).toHaveLength(1);
  });

  it('updates tickers_json and summary on conflict', () => {
    const a = makeArticle('https://c.com/itub', 'ITUB4 resultado', 'ITUB4', 'financeiro');
    upsertArticles(db, [a]);

    const updated: Article = { ...a, tickers: ['ITUB4', 'BBAS3'], summary: 'Sumário atualizado' };
    upsertArticles(db, [updated]);

    const byBBAS3 = listByTicker(db, 'BBAS3', 10);
    expect(byBBAS3).toHaveLength(1);
    expect(byBBAS3[0]?.summary).toBe('Sumário atualizado');
  });

  it('normalizes URL — trailing slash and case are unified', () => {
    const a1: Article = { ...makeArticle('HTTPS://InfoMoney.com.br/noticia/', 'Art1', 'PETR4', 'commodities') };
    const a2: Article = { ...makeArticle('https://infomoney.com.br/noticia', 'Art2', 'PETR4', 'commodities') };
    upsertArticles(db, [a1]);
    upsertArticles(db, [a2]);

    const articles = listByTicker(db, 'PETR4', 10);
    expect(articles).toHaveLength(1);
  });

  it('inserts batch of multiple articles', () => {
    upsertArticles(db, [
      makeArticle('https://a.com/1', 'Art 1', 'ITUB4', 'financeiro'),
      makeArticle('https://a.com/2', 'Art 2', 'BBDC4', 'financeiro'),
      makeArticle('https://a.com/3', 'Art 3', 'VALE3', 'commodities'),
    ]);
    expect(listByCategory(db, 'financeiro', 10)).toHaveLength(2);
    expect(listByCategory(db, 'commodities', 10)).toHaveLength(1);
  });

  it('populates id after insert', () => {
    upsertArticles(db, [makeArticle('https://id.com/art', 'Com ID', 'RDOR3', 'saude')]);
    const articles = listByTicker(db, 'RDOR3', 1);
    expect(articles[0]?.id).toBeGreaterThan(0);
  });
});

describe('listByTicker', () => {
  it('is case-insensitive for the query ticker', () => {
    upsertArticles(db, [makeArticle('https://d.com/1', 'Teste', 'PETR4', 'commodities')]);
    expect(listByTicker(db, 'petr4', 10)).toHaveLength(1);
  });

  it('finds article in multi-ticker array', () => {
    const a: Article = {
      url: 'https://e.com/multi',
      title: 'Multi',
      tickers: ['PETR4', 'VALE3', 'ITUB4'],
      fetchedAt: new Date().toISOString(),
    };
    upsertArticles(db, [a]);

    for (const ticker of ['PETR4', 'VALE3', 'ITUB4']) {
      expect(listByTicker(db, ticker, 10)).toHaveLength(1);
    }
  });

  it('returns empty array for unknown ticker', () => {
    expect(listByTicker(db, 'NONEXISTENT', 10)).toHaveLength(0);
  });

  it('respects limit', () => {
    for (let i = 0; i < 5; i++) {
      upsertArticles(db, [makeArticle(`https://lim.com/${i}`, `Article ${i}`, 'TOTS3', 'tecnologia')]);
    }
    expect(listByTicker(db, 'TOTS3', 3)).toHaveLength(3);
  });
});

describe('listByCategory', () => {
  it('returns articles for a matching category', () => {
    upsertArticles(db, [makeArticle('https://f.com/1', 'Art', 'VALE3', 'commodities')]);
    expect(listByCategory(db, 'commodities', 10)).toHaveLength(1);
  });

  it('returns empty array for unknown category', () => {
    expect(listByCategory(db, 'nonexistent', 10)).toHaveLength(0);
  });
});

describe('listRecent', () => {
  it('returns only articles fetched after the given date', () => {
    const now = new Date();
    const old = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2h ago
    const recent = new Date(now.getTime() - 30 * 60 * 1000);   // 30min ago

    upsertArticles(db, [
      { url: 'https://x.com/old', title: 'Antigo', tickers: ['ELET3'], fetchedAt: old.toISOString() },
      { url: 'https://x.com/recent', title: 'Recente', tickers: ['ELET3'], fetchedAt: recent.toISOString() },
    ]);

    const since = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const articles = listRecent(db, since.toISOString(), 10);
    expect(articles).toHaveLength(1);
    expect(articles[0]?.title).toBe('Recente');
  });
});

describe('pruneArticles', () => {
  it('deletes articles older than the cutoff and returns count', () => {
    const now = Date.now();
    const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
    const old = new Date(now - thirtyOneDaysMs).toISOString();

    upsertArticles(db, [
      { url: 'https://p.com/old', title: 'Velho', tickers: ['MGLU3'], fetchedAt: old },
      { url: 'https://p.com/new', title: 'Novo', tickers: ['MGLU3'], fetchedAt: new Date(now).toISOString() },
    ]);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const deleted = pruneArticles(db, thirtyDaysMs);
    expect(deleted).toBe(1);

    const remaining = listByTicker(db, 'MGLU3', 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.title).toBe('Novo');
  });

  it('returns 0 when nothing qualifies for pruning', () => {
    upsertArticles(db, [makeArticle('https://fresh.com/art', 'Fresco', 'SBSP3', 'saneamento')]);
    const deleted = pruneArticles(db, 30 * 24 * 60 * 60 * 1000);
    expect(deleted).toBe(0);
  });
});
