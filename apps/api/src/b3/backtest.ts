/**
 * Simple walk-forward backtest: re-applies the score on each historical day
 * and checks whether the resulting signal would have been correct 5 trading
 * days later (D+5 price direction).
 *
 * Only strong-confluence signals (|score| ≥ 4) count as predictions.
 * Hit = signal direction matches D+5 close direction.
 */
import type { HistoryPoint } from './types.ts';
import { computeIndicators } from './indicators.ts';
import { computeScore } from './score.ts';

export interface BacktestResult {
  totalPredictions: number;
  hits: number;
  accuracy: number;  // 0-100
  lookbackDays: number;
  forwardDays: number;
  /** Per-signal breakdown for transparency */
  breakdown: {
    buy: { total: number; hits: number };
    sell: { total: number; hits: number };
  };
}

export function backtest(
  history: HistoryPoint[],
  high52w: number,
  low52w: number,
  lookbackDays = 60,
  forwardDays = 5,
): BacktestResult {
  // Need at least `lookbackDays + forwardDays + 50` to compute indicators reliably
  // (SMA50 window) in each iteration.
  const MIN_INDICATOR_WINDOW = 50;
  const earliest = MIN_INDICATOR_WINDOW;
  const latest = history.length - forwardDays;

  if (latest <= earliest) {
    return {
      totalPredictions: 0,
      hits: 0,
      accuracy: 0,
      lookbackDays,
      forwardDays,
      breakdown: { buy: { total: 0, hits: 0 }, sell: { total: 0, hits: 0 } },
    };
  }

  const startIdx = Math.max(earliest, latest - lookbackDays);
  let buyTotal = 0, buyHits = 0, sellTotal = 0, sellHits = 0;

  for (let i = startIdx; i < latest; i++) {
    const slice = history.slice(0, i + 1);
    const priceNow = slice[slice.length - 1]!.close;
    const priceFuture = history[i + forwardDays]!.close;

    const ind = computeIndicators(slice, high52w, low52w);
    // IBOV filter deliberately omitted in backtest: we measure pure
    // confluence; adding IBOV just amplifies the same signal in both directions.
    const score = computeScore(priceNow, ind, slice, 'lateral');

    // Only count high-confluence signals (≥4) — matches production filter
    if (score.signal === 'compra_forte') {
      buyTotal++;
      if (priceFuture > priceNow) buyHits++;
    } else if (score.signal === 'venda_forte') {
      sellTotal++;
      if (priceFuture < priceNow) sellHits++;
    }
  }

  const total = buyTotal + sellTotal;
  const hits = buyHits + sellHits;
  const accuracy = total === 0 ? 0 : Math.round((hits / total) * 1000) / 10;

  return {
    totalPredictions: total,
    hits,
    accuracy,
    lookbackDays,
    forwardDays,
    breakdown: {
      buy: { total: buyTotal, hits: buyHits },
      sell: { total: sellTotal, hits: sellHits },
    },
  };
}
