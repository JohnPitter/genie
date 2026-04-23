/**
 * Technical indicators computed in pure TypeScript — no external libraries.
 * All functions operate on arrays of closing prices (oldest → newest).
 */
import type { TechnicalIndicators, MACD, BollingerBands, HistoryPoint } from './types.ts';

// ── Primitives ────────────────────────────────────────────────────────────────

function sma(prices: number[], n: number): number | null {
  if (prices.length < n) return null;
  const slice = prices.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function emaSeries(prices: number[], n: number): number[] {
  if (prices.length < n) return [];
  const k = 2 / (n + 1);
  // Seed with first SMA
  let val = prices.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const result: number[] = [val];
  for (let i = n; i < prices.length; i++) {
    val = prices[i]! * k + val * (1 - k);
    result.push(val);
  }
  return result;
}

// ── RSI (14) ──────────────────────────────────────────────────────────────────

export function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  const changes = closes.slice(1).map((p, i) => p - closes[i]!);
  const recentChanges = changes.slice(-(period));

  // Wilder smoothing initial values
  let avgGain = recentChanges.filter(c => c > 0).reduce((s, c) => s + c, 0) / period;
  let avgLoss = recentChanges.filter(c => c < 0).reduce((s, c) => s + Math.abs(c), 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

// ── MACD (12, 26, 9) ──────────────────────────────────────────────────────────

export function computeMACD(closes: number[]): MACD | null {
  if (closes.length < 35) return null;

  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);

  // Align both series (ema26 is shorter)
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((e26, i) => ema12[i + offset]! - e26);

  if (macdLine.length < 9) return null;
  const signalSeries = emaSeries(macdLine, 9);
  if (!signalSeries.length) return null;

  const line = macdLine[macdLine.length - 1]!;
  const signal = signalSeries[signalSeries.length - 1]!;

  return {
    line: Math.round(line * 10000) / 10000,
    signal: Math.round(signal * 10000) / 10000,
    histogram: Math.round((line - signal) * 10000) / 10000,
  };
}

// ── Bollinger Bands (20, 2) ────────────────────────────────────────────────────

export function computeBollinger(closes: number[], n = 20, stdMult = 2): BollingerBands | null {
  if (closes.length < n) return null;

  const slice = closes.slice(-n);
  const middle = slice.reduce((a, b) => a + b, 0) / n;
  const variance = slice.reduce((sum, p) => sum + (p - middle) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const upper = middle + stdMult * std;
  const lower = middle - stdMult * std;
  const current = closes[closes.length - 1]!;
  const percentB = upper === lower ? 50 : ((current - lower) / (upper - lower)) * 100;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    percentB: Math.round(percentB * 10) / 10,
  };
}

// ── Volatility (annualised) ────────────────────────────────────────────────────

export function computeVolatility30d(closes: number[]): number | null {
  if (closes.length < 22) return null;
  const slice = closes.slice(-31);
  const returns = slice.slice(1).map((p, i) => Math.log(p / slice[i]!));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  // Annualise: ×√252
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100 * 100) / 100;
}

// ── Return ─────────────────────────────────────────────────────────────────────

export function computeReturn30d(closes: number[]): number | null {
  if (closes.length < 21) return null;
  const first = closes[closes.length - 21]!;
  const last = closes[closes.length - 1]!;
  return Math.round(((last - first) / first) * 10000) / 100;
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function computeIndicators(
  history: HistoryPoint[],
  high52w: number,
  low52w: number,
): TechnicalIndicators {
  const closes = history.map(p => p.close);

  return {
    sma20: round2(sma(closes, 20)),
    sma50: round2(sma(closes, 50)),
    rsi14: computeRSI(closes),
    macd: computeMACD(closes),
    bollinger: computeBollinger(closes),
    return30d: computeReturn30d(closes),
    volatility30d: computeVolatility30d(closes),
    high52w,
    low52w,
  };
}

// ── Label helpers (used by analyst prompt) ─────────────────────────────────────

export function rsiLabel(rsi: number): string {
  if (rsi >= 70) return 'sobrecomprado';
  if (rsi <= 30) return 'sobrevendido';
  if (rsi >= 60) return 'forte/sobrecomprado';
  if (rsi <= 40) return 'fraco/sobrevendido';
  return 'neutro';
}

export function macdSignal(macd: MACD): string {
  if (macd.histogram > 0 && macd.line > 0) return 'alta confirmada';
  if (macd.histogram > 0 && macd.line <= 0) return 'virando para alta';
  if (macd.histogram < 0 && macd.line < 0) return 'baixa confirmada';
  return 'virando para baixa';
}

export function bollingerPosition(bb: BollingerBands): string {
  if (bb.percentB >= 100) return 'acima da banda superior (possível reversão)';
  if (bb.percentB <= 0) return 'abaixo da banda inferior (possível reversão)';
  if (bb.percentB >= 80) return 'próximo da banda superior';
  if (bb.percentB <= 20) return 'próximo da banda inferior';
  return 'dentro das bandas (neutro)';
}

// ── Utility ─────────────────────────────────────────────────────────────────────

function round2(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(v * 100) / 100;
}
