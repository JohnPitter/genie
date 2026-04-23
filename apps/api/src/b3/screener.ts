/**
 * Screener: roda o pipeline de análise (histórico → indicadores → score → backtest)
 * para múltiplos tickers em paralelo, com concorrência limitada para evitar
 * rate-limit nas fontes externas.
 *
 * O screener NÃO chama o LLM — é puramente determinístico. O LLM é chamado
 * apenas na página /analise/[ticker] (análise detalhada on-demand).
 */
import { fetchHistory } from './history.ts';
import { computeIndicators } from './indicators.ts';
import { computeScore } from './score.ts';
import { backtest } from './backtest.ts';
import type { IbovTrend } from './ibov.ts';
import { fetchIbovTrend } from './ibov.ts';
import type { DB } from '../store/db.ts';
import { insertPrediction } from '../store/predictions.ts';
import type { Logger } from 'pino';

const CONCURRENCY = 4;

export interface ScreenerResult {
  success: number;
  failed: number;
  ibovTrend: IbovTrend;
  durationMs: number;
}

export async function runScreener(
  tickers: string[],
  db: DB,
  log: Logger,
  signal?: AbortSignal,
): Promise<ScreenerResult> {
  const t0 = Date.now();
  log.info({ count: tickers.length }, 'screener: starting');

  // 1. Macro trend (once for all tickers)
  let ibovTrend: IbovTrend = 'lateral';
  try {
    const ibov = await fetchIbovTrend(signal, log);
    ibovTrend = ibov.trend;
  } catch (err) {
    log.warn({ err }, 'screener: ibov fetch failed, defaulting to lateral');
  }

  const computedAt = new Date().toISOString();
  let success = 0;
  let failed = 0;

  // 2. Run in parallel batches
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    if (signal?.aborted) break;
    const batch = tickers.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(ticker => analyseOne(ticker, ibovTrend, computedAt, db, log, signal)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') success++;
      else failed++;
    }
    // Pequeno delay entre batches para respeitar rate limit do Yahoo Finance
    await new Promise(res => setTimeout(res, 200));
  }

  const durationMs = Date.now() - t0;
  log.info({ success, failed, ibovTrend, durationMs }, 'screener: done');
  return { success, failed, ibovTrend, durationMs };
}

async function analyseOne(
  ticker: string,
  ibovTrend: IbovTrend,
  computedAt: string,
  db: DB,
  log: Logger,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const hist = await fetchHistory(ticker, 180, signal, log);
    if (hist.history.length < 60) {
      log.debug({ ticker, points: hist.history.length }, 'screener: insufficient history');
      return;
    }
    const indicators = computeIndicators(hist.history, hist.high52w, hist.low52w);
    const score = computeScore(hist.currentPrice, indicators, hist.history, ibovTrend);
    const bt = backtest(hist.history, hist.high52w, hist.low52w, 60, 5);

    insertPrediction(db, {
      ticker,
      name: hist.name,
      price: hist.currentPrice,
      changePct: hist.changePct,
      signal: score.signal,
      score: score.total,
      confidence: score.confidence,
      votes: score.votes,
      backtestAccuracy: bt.totalPredictions > 0 ? bt.accuracy : null,
      backtestTotal: bt.totalPredictions || null,
      rationale: null, // LLM rationale só é gerado on-demand em /analise/[ticker]
      computedAt,
    });

    log.debug({ ticker, signal: score.signal, score: score.total, btAccuracy: bt.accuracy }, 'screener: ticker done');
  } catch (err) {
    log.warn({ ticker, err: err instanceof Error ? err.message : String(err) }, 'screener: ticker failed');
    throw err;
  }
}
