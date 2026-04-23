import type { Logger } from 'pino';
import { listFavorites } from '../store/favorites.ts';
import type { DB } from '../store/db.ts';
import type { NewsService } from '../news/service.ts';
import type { Source } from '../b3/source.ts';
import { allTickers } from '../b3/categories.ts';

export class NewsRefreshJob {
  constructor(
    private readonly db: DB,
    private readonly newsSvc: NewsService,
    private readonly b3?: Source,
    private readonly log?: Logger,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const start = Date.now();
    this.log?.info('news-refresh job started');

    // Refresh all categories
    const { fetched, firstError } = await this.newsSvc.refreshTickers(allTickers().slice(0, 20), signal);
    if (firstError) this.log?.error({ err: firstError }, 'news-refresh: category refresh had errors');
    this.log?.info({ articles: fetched }, 'news-refresh: tickers done');

    if (signal?.aborted) return;

    // Refresh favorited tickers
    const favs = listFavorites(this.db);
    if (favs.length) {
      const tickers = favs.map(f => f.ticker);
      await this.newsSvc.refreshTickers(tickers, signal);

      // Warm quote cache for favorites
      if (this.b3) {
        await Promise.allSettled(tickers.map(t => this.b3!.quote(t)));
        this.log?.info({ tickers: tickers.length }, 'news-refresh: quote cache warmed');
      }
    }

    this.log?.info({ durationMs: Date.now() - start }, 'news-refresh job finished');
  }
}
