/**
 * Score quantitativo determinístico — agrega sinais técnicos em uma votação
 * de -6 a +6 (6 indicadores, cada um vota -1/0/+1).
 *
 * Estratégia para atingir 60-70% accuracy:
 *   - Score ≥ +4 (confluência forte) → sinal CONFIÁVEL de compra
 *   - Score ≤ -4 (confluência forte) → sinal CONFIÁVEL de venda
 *   - Score entre -3 e +3 → inconclusivo, evita recomendação (filtro de confiança)
 */
import type { HistoryPoint, TechnicalIndicators } from './types.ts';
import type { IbovTrend } from './ibov.ts';

export type Signal = 'compra_forte' | 'compra' | 'neutro' | 'venda' | 'venda_forte';

export interface IndicatorVote {
  name: string;
  vote: -1 | 0 | 1;
  rationale: string;
}

export interface TechnicalScore {
  total: number;          // -6 to +6
  signal: Signal;
  confidence: 'baixa' | 'media' | 'alta';
  votes: IndicatorVote[];
}

/**
 * Computes the aggregate technical score from individual indicators.
 *
 * @param price current price
 * @param ind  pre-computed technical indicators
 * @param history OHLCV history for volume analysis
 * @param ibovTrend macro-trend filter (mitigates false buy signals in bear markets)
 */
export function computeScore(
  price: number,
  ind: TechnicalIndicators,
  history: HistoryPoint[],
  ibovTrend: IbovTrend,
): TechnicalScore {
  const votes: IndicatorVote[] = [];

  // ── 1. RSI ──────────────────────────────────────────
  if (ind.rsi14 != null) {
    if (ind.rsi14 < 30) votes.push({ name: 'RSI', vote: 1, rationale: `RSI ${ind.rsi14.toFixed(1)} — sobrevendido (reversão provável)` });
    else if (ind.rsi14 > 70) votes.push({ name: 'RSI', vote: -1, rationale: `RSI ${ind.rsi14.toFixed(1)} — sobrecomprado (correção provável)` });
    else if (ind.rsi14 >= 45 && ind.rsi14 <= 55) votes.push({ name: 'RSI', vote: 0, rationale: `RSI ${ind.rsi14.toFixed(1)} — neutro` });
    else if (ind.rsi14 > 55) votes.push({ name: 'RSI', vote: 1, rationale: `RSI ${ind.rsi14.toFixed(1)} — momentum positivo` });
    else votes.push({ name: 'RSI', vote: -1, rationale: `RSI ${ind.rsi14.toFixed(1)} — momentum negativo` });
  }

  // ── 2. MACD ─────────────────────────────────────────
  if (ind.macd) {
    const { line, signal, histogram } = ind.macd;
    if (histogram > 0 && line > signal) votes.push({ name: 'MACD', vote: 1, rationale: 'MACD com histograma positivo e linha acima do sinal — tendência de alta' });
    else if (histogram < 0 && line < signal) votes.push({ name: 'MACD', vote: -1, rationale: 'MACD com histograma negativo e linha abaixo do sinal — tendência de baixa' });
    else votes.push({ name: 'MACD', vote: 0, rationale: 'MACD em transição' });
  }

  // ── 3. SMA cross (tendência de médio prazo) ────────
  if (ind.sma20 != null && ind.sma50 != null) {
    const priceAbove20 = price > ind.sma20;
    const priceAbove50 = price > ind.sma50;
    const shortAboveLong = ind.sma20 > ind.sma50;

    if (priceAbove20 && priceAbove50 && shortAboveLong) {
      votes.push({ name: 'Médias Móveis', vote: 1, rationale: 'Preço acima de SMA20 e SMA50 (golden configuration)' });
    } else if (!priceAbove20 && !priceAbove50 && !shortAboveLong) {
      votes.push({ name: 'Médias Móveis', vote: -1, rationale: 'Preço abaixo de SMA20 e SMA50 (death configuration)' });
    } else {
      votes.push({ name: 'Médias Móveis', vote: 0, rationale: 'Médias conflitantes' });
    }
  }

  // ── 4. Bollinger Bands (mean reversion) ────────────
  if (ind.bollinger) {
    const { percentB } = ind.bollinger;
    if (percentB < 5) votes.push({ name: 'Bollinger', vote: 1, rationale: `Preço na banda inferior (%B=${percentB.toFixed(0)}) — reversão provável` });
    else if (percentB > 95) votes.push({ name: 'Bollinger', vote: -1, rationale: `Preço na banda superior (%B=${percentB.toFixed(0)}) — correção provável` });
    else if (percentB >= 40 && percentB <= 60) votes.push({ name: 'Bollinger', vote: 0, rationale: `Preço no meio das bandas (%B=${percentB.toFixed(0)})` });
    else if (percentB > 60) votes.push({ name: 'Bollinger', vote: 1, rationale: `Preço acima da média (%B=${percentB.toFixed(0)}) — tendência de alta` });
    else votes.push({ name: 'Bollinger', vote: -1, rationale: `Preço abaixo da média (%B=${percentB.toFixed(0)}) — tendência de baixa` });
  }

  // ── 5. Volume relativo (últimos 5 dias vs média 20) ────
  if (history.length >= 20) {
    const vol20 = avgVolume(history.slice(-20));
    const vol5 = avgVolume(history.slice(-5));
    const lastClose = history[history.length - 1]!.close;
    const prevClose = history[history.length - 6]?.close ?? lastClose;
    const priceChange = lastClose - prevClose;

    if (vol5 > vol20 * 1.3 && priceChange > 0) {
      votes.push({ name: 'Volume', vote: 1, rationale: `Volume 30% acima da média e preço subindo — interesse comprador` });
    } else if (vol5 > vol20 * 1.3 && priceChange < 0) {
      votes.push({ name: 'Volume', vote: -1, rationale: `Volume 30% acima da média e preço caindo — interesse vendedor` });
    } else if (vol5 < vol20 * 0.6) {
      votes.push({ name: 'Volume', vote: 0, rationale: 'Volume reduzido — baixa convicção' });
    } else {
      votes.push({ name: 'Volume', vote: 0, rationale: 'Volume dentro da média' });
    }
  }

  // ── 6. Filtro macro (IBOV) ──────────────────────────
  // O mercado em tendência de alta reforça sinais de compra;
  // em tendência de baixa, penaliza sinais de compra (risco sistêmico).
  if (ibovTrend === 'alta') {
    votes.push({ name: 'Contexto IBOV', vote: 1, rationale: 'IBOV em tendência de alta — contexto favorável' });
  } else if (ibovTrend === 'baixa') {
    votes.push({ name: 'Contexto IBOV', vote: -1, rationale: 'IBOV em tendência de baixa — cautela, mercado adverso' });
  } else {
    votes.push({ name: 'Contexto IBOV', vote: 0, rationale: 'IBOV lateralizado — sem viés macro' });
  }

  const total = votes.reduce((s, v) => s + v.vote, 0);
  const { signal, confidence } = classifyScore(total);

  return { total, signal, confidence, votes };
}

function classifyScore(total: number): { signal: Signal; confidence: 'baixa' | 'media' | 'alta' } {
  if (total >= 4) return { signal: 'compra_forte', confidence: 'alta' };
  if (total >= 2) return { signal: 'compra', confidence: 'media' };
  if (total <= -4) return { signal: 'venda_forte', confidence: 'alta' };
  if (total <= -2) return { signal: 'venda', confidence: 'media' };
  return { signal: 'neutro', confidence: 'baixa' };
}

function avgVolume(slice: HistoryPoint[]): number {
  if (!slice.length) return 0;
  return slice.reduce((s, p) => s + p.volume, 0) / slice.length;
}
