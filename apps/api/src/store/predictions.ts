import type { DB } from './db.ts';
import type { Signal, IndicatorVote } from '../b3/score.ts';

export interface PredictionRow {
  id: number;
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  signal: Signal;
  score: number;
  confidence: 'baixa' | 'media' | 'alta';
  votes: IndicatorVote[];
  backtestAccuracy: number | null;
  backtestTotal: number | null;
  rationale: string | null;
  computedAt: string;
}

export interface PredictionInsert {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  signal: Signal;
  score: number;
  confidence: 'baixa' | 'media' | 'alta';
  votes: IndicatorVote[];
  backtestAccuracy: number | null;
  backtestTotal: number | null;
  rationale: string | null;
  computedAt: string;
}

interface RawRow {
  id: number;
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  signal: string;
  score: number;
  confidence: string;
  votes_json: string;
  backtest_accuracy: number | null;
  backtest_total: number | null;
  rationale: string | null;
  computed_at: string;
}

function rowToItem(row: RawRow): PredictionRow {
  let votes: IndicatorVote[] = [];
  try {
    votes = JSON.parse(row.votes_json) as IndicatorVote[];
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    price: row.price,
    changePct: row.change_pct,
    signal: row.signal as Signal,
    score: row.score,
    confidence: row.confidence as 'baixa' | 'media' | 'alta',
    votes,
    backtestAccuracy: row.backtest_accuracy,
    backtestTotal: row.backtest_total,
    rationale: row.rationale,
    computedAt: row.computed_at,
  };
}

export function insertPrediction(db: DB, p: PredictionInsert): void {
  db.prepare(`
    INSERT INTO predictions
      (ticker, name, price, change_pct, signal, score, confidence, votes_json,
       backtest_accuracy, backtest_total, rationale, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.ticker, p.name, p.price, p.changePct, p.signal, p.score, p.confidence,
    JSON.stringify(p.votes),
    p.backtestAccuracy, p.backtestTotal, p.rationale, p.computedAt,
  );
}

/** Retorna a predição mais recente por ticker (DISTINCT ON equivalent em SQLite). */
export function latestPredictions(db: DB, limit = 100): PredictionRow[] {
  const rows = db.prepare<[number], RawRow>(`
    SELECT id, ticker, name, price, change_pct, signal, score, confidence,
           votes_json, backtest_accuracy, backtest_total, rationale, computed_at
    FROM predictions
    WHERE id IN (
      SELECT MAX(id) FROM predictions GROUP BY ticker
    )
    ORDER BY computed_at DESC, ABS(score) DESC
    LIMIT ?
  `).all(limit);
  return rows.map(rowToItem);
}

export function latestPredictionForTicker(db: DB, ticker: string): PredictionRow | null {
  const row = db.prepare<[string], RawRow>(`
    SELECT id, ticker, name, price, change_pct, signal, score, confidence,
           votes_json, backtest_accuracy, backtest_total, rationale, computed_at
    FROM predictions
    WHERE ticker = ?
    ORDER BY computed_at DESC
    LIMIT 1
  `).get(ticker.toUpperCase());
  return row ? rowToItem(row) : null;
}

/** Mantém só os últimos N dias de predições para evitar crescimento infinito. */
export function prunePredictions(db: DB, olderThanDays: number): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  const result = db.prepare('DELETE FROM predictions WHERE computed_at < ?').run(cutoff);
  return result.changes;
}
