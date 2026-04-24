import type { Logger } from 'pino';
import { listFavorites } from '../store/favorites.ts';
import type { DB } from '../store/db.ts';
import type { NewsService } from '../news/service.ts';
import type { Source } from '../b3/source.ts';
import { balancedTickers } from '../b3/categories.ts';

// 4 tickers × 7 categorias = 28 — cobertura balanceada para o editorial poder
// gerar seções de todas as categorias, vs. slice(N) que enviesa para a primeira.
const TICKERS_PER_CATEGORY = 4;

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

    // Refresh balanced selection across all categories
    const tickers = balancedTickers(TICKERS_PER_CATEGORY);
    const { fetched, firstError } = await this.newsSvc.refreshTickers(tickers, signal);
    if (firstError) this.log?.error({ err: firstError }, 'news-refresh: category refresh had errors');
    this.log?.info({ articles: fetched, tickers: tickers.length }, 'news-refresh: tickers done');

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
