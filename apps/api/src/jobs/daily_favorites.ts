import type { Logger } from 'pino';
import { listFavorites, updateLastNewsAt } from '../store/favorites.ts';
import type { DB } from '../store/db.ts';
import type { NewsService } from '../news/service.ts';

export class DailyFavoritesJob {
  constructor(
    private readonly db: DB,
    private readonly newsSvc: NewsService,
    private readonly log: Logger,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const start = Date.now();
    this.log.info('daily-favorites-news job started');

    const favs = listFavorites(this.db);
    if (!favs.length) {
      this.log.info('no favorites, skipping news refresh');
      return;
    }

    const tickers = favs.map(f => f.ticker);
    this.log.info({ tickers }, 'refreshing news for favorited tickers');

    const { fetched, firstError } = await this.newsSvc.refreshTickers(tickers, signal);
    if (firstError) this.log.error({ err: firstError }, 'RefreshTickers had errors');

    let updateErrors = 0;
    const now = new Date().toISOString();
    for (const ticker of tickers) {
      if (signal?.aborted) break;
      try {
        updateLastNewsAt(this.db, ticker, now);
      } catch (err) {
        this.log.error({ err, ticker }, 'UpdateLastNewsAt failed');
        updateErrors++;
      }
    }

    this.log.info(
      { fetched, tickers: tickers.length, updateErrors, durationMs: Date.now() - start },
      'daily-favorites-news job finished',
    );
  }
}
