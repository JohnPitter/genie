import { runScreener } from '../b3/screener.ts';
import { allTickers } from '../b3/categories.ts';
import { prunePredictions } from '../store/predictions.ts';
import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';

const MAX_TICKERS_PER_RUN = 60; // capa para não abusar da API do Yahoo Finance
const RETAIN_DAYS = 30;

export class PredictionsRefreshJob {
  constructor(
    private readonly db: DB,
    private readonly log: Logger,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const tickers = allTickers().slice(0, MAX_TICKERS_PER_RUN);
    this.log.info({ count: tickers.length }, 'predictions_refresh: starting');

    try {
      const result = await runScreener(tickers, this.db, this.log, signal);
      prunePredictions(this.db, RETAIN_DAYS);
      this.log.info(result, 'predictions_refresh: complete');
    } catch (err) {
      this.log.error({ err }, 'predictions_refresh: failed');
    }
  }
}
