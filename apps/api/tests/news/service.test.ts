import { describe, it, expect, beforeEach } from 'vitest';
import { NewsService } from '../../src/news/service.ts';
import type { NewsSearcher, SearchResult } from '../../src/news/service.ts';
import { openTestDB } from '../store/helpers.ts';
import type { DB } from '../../src/store/db.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function makeSearcher(results: SearchResult[]): NewsSearcher {
  return {
    search: async () => results,
  };
}

const SAMPLE_RESULTS: SearchResult[] = [
  { title: 'PETR4 sobe forte', url: 'https://infomoney.com.br/petr4-sobe', snippet: 'Petrobras subiu' },
  { title: 'PETR4 dividendos', url: 'https://valor.com.br/petr4-div', snippet: 'Petrobras pagou' },
];

let db: DB;

beforeEach(() => {
  db = openTestDB();
});

describe('NewsService.byTicker', () => {
  it('searches web when DB is empty', async () => {
    const svc = new NewsService(db, makeSearcher(SAMPLE_RESULTS), nop);
    const articles = await svc.byTicker('PETR4');

    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0]?.tickers).toContain('PETR4');
    svc.stop();
  });

  it('returns from cache on second call without re-searching', async () => {
    let searchCount = 0;
    const searcher: NewsSearcher = { search: async () => { searchCount++; return SAMPLE_RESULTS; } };
    const svc = new NewsService(db, searcher, nop);

    await svc.byTicker('VALE3');
    await svc.byTicker('VALE3');

    expect(searchCount).toBe(1);
    svc.stop();
  });

  it('normalizes ticker to uppercase', async () => {
    let queriedTicker = '';
    const searcher: NewsSearcher = {
      search: async (query) => { queriedTicker = query; return SAMPLE_RESULTS; },
    };
    const svc = new NewsService(db, searcher, nop);
    await svc.byTicker('petr4');
    expect(queriedTicker).toContain('PETR4');
    svc.stop();
  });

  it('throws for empty ticker', async () => {
    const svc = new NewsService(db, makeSearcher([]), nop);
    await expect(svc.byTicker('')).rejects.toThrow('ticker must not be empty');
    svc.stop();
  });

  it('respects limit', async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      title: `Art ${i}`,
      url: `https://x.com/${i}`,
      snippet: '',
    }));
    const svc = new NewsService(db, makeSearcher(manyResults), nop);
    const articles = await svc.byTicker('ITUB4', 3);
    expect(articles.length).toBeLessThanOrEqual(3);
    svc.stop();
  });
});

describe('NewsService.byCategory', () => {
  it('searches web when DB is empty', async () => {
    const svc = new NewsService(db, makeSearcher(SAMPLE_RESULTS), nop);
    const articles = await svc.byCategory('commodities');
    expect(articles.length).toBeGreaterThan(0);
    svc.stop();
  });

  it('caches results on second call', async () => {
    let calls = 0;
    const searcher: NewsSearcher = { search: async () => { calls++; return SAMPLE_RESULTS; } };
    const svc = new NewsService(db, searcher, nop);

    await svc.byCategory('financeiro');
    await svc.byCategory('financeiro');

    expect(calls).toBeLessThan(40); // first call fetches 15+ tickers but not double
    svc.stop();
  });
});

describe('NewsService.refreshTickers', () => {
  it('fetches and persists articles for each ticker', async () => {
    const svc = new NewsService(db, makeSearcher(SAMPLE_RESULTS), nop);
    const { fetched, firstError } = await svc.refreshTickers(['PETR4', 'VALE3']);
    expect(fetched).toBeGreaterThan(0);
    expect(firstError).toBeNull();
    svc.stop();
  });

  it('continues on search errors and captures first error', async () => {
    let call = 0;
    const searcher: NewsSearcher = {
      search: async () => {
        if (call++ === 0) throw new Error('search failed');
        return SAMPLE_RESULTS;
      },
    };
    const svc = new NewsService(db, searcher, nop);
    const { fetched, firstError } = await svc.refreshTickers(['PETR4', 'VALE3']);
    expect(firstError).not.toBeNull();
    expect(fetched).toBeGreaterThan(0); // VALE3 succeeded
    svc.stop();
  });
});
