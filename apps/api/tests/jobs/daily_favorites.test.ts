import { describe, it, expect, beforeEach } from 'vitest';
import { DailyFavoritesJob } from '../../src/jobs/daily_favorites.ts';
import { openTestDB } from '../store/helpers.ts';
import { addFavorite } from '../../src/store/favorites.ts';
import type { DB } from '../../src/store/db.ts';
import type { NewsService, SearchResult } from '../../src/news/service.ts';
import type { NewsSearcher } from '../../src/news/service.ts';
import { NewsService as NewsServiceImpl } from '../../src/news/service.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function makeNewsService(db: DB, results: SearchResult[] = []): NewsService {
  const searcher: NewsSearcher = { search: async () => results };
  return new NewsServiceImpl(db, searcher, nop);
}

let db: DB;

beforeEach(() => { db = openTestDB(); });

describe('DailyFavoritesJob', () => {
  it('runs without error when there are no favorites', async () => {
    const svc = makeNewsService(db);
    const job = new DailyFavoritesJob(db, svc, nop);
    await expect(job.run()).resolves.not.toThrow();
    svc.stop();
  });

  it('refreshes news for all favorited tickers', async () => {
    addFavorite(db, 'PETR4');
    addFavorite(db, 'VALE3');

    let searchCount = 0;
    const searcher: NewsSearcher = {
      search: async () => { searchCount++; return []; },
    };
    const svc = new NewsServiceImpl(db, searcher, nop);
    const job = new DailyFavoritesJob(db, svc, nop);
    await job.run();

    expect(searchCount).toBeGreaterThan(0);
    svc.stop();
  });

  it('stamps last_news_at on each ticker after refresh', async () => {
    addFavorite(db, 'ITUB4');
    const svc = makeNewsService(db);
    const job = new DailyFavoritesJob(db, svc, nop);
    await job.run();

    const favs = (db.prepare('SELECT ticker, last_news_at FROM favorites WHERE ticker = ?')
      .all('ITUB4')) as Array<{ ticker: string; last_news_at: string | null }>;
    expect(favs[0]?.last_news_at).not.toBeNull();
    svc.stop();
  });
});
