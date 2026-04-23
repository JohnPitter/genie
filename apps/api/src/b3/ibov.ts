/**
 * Fetches the IBOV (Bovespa index) trend — used as a macro filter.
 * We only want to issue strong BUY signals when the market itself is not
 * in a clear downtrend (risk-off environment).
 */
import { buildHeaders, fetchWithTimeout } from './http.ts';
import type { Logger } from 'pino';

const BASE_URL = 'https://query2.finance.yahoo.com';
const TIMEOUT_MS = 15_000;
const IBOV_SYMBOL = '%5EBVSP'; // ^BVSP URL-encoded

interface YFChartResult {
  meta: { regularMarketPrice: number };
  timestamp: number[];
  indicators: { quote: Array<{ close: number[] }> };
}

interface YFChartResponse {
  chart: { result: YFChartResult[] | null; error?: { description: string } | null };
}

export type IbovTrend = 'alta' | 'lateral' | 'baixa';

export interface IbovSnapshot {
  trend: IbovTrend;
  sma20: number;
  sma50: number;
  currentPrice: number;
  return30d: number;
}

export async function fetchIbovTrend(
  signal?: AbortSignal,
  log?: Logger,
): Promise<IbovSnapshot> {
  const url = `${BASE_URL}/v8/finance/chart/${IBOV_SYMBOL}?interval=1d&range=3mo`;
  const resp = await fetchWithTimeout(url, buildHeaders(), TIMEOUT_MS, signal);

  if (!resp.ok) throw new Error(`ibov: HTTP ${resp.status}`);
  const data = (await resp.json()) as YFChartResponse;
  if (data.chart.error || !data.chart.result?.length) {
    throw new Error('ibov: no data');
  }

  const result = data.chart.result[0]!;
  const closes = result.indicators.quote[0]!.close.filter((n): n is number => n != null);
  const currentPrice = result.meta.regularMarketPrice;

  const sma20 = avgLast(closes, 20);
  const sma50 = avgLast(closes, 50);
  const return30d = calcReturn(closes, 21);

  let trend: IbovTrend = 'lateral';
  if (currentPrice > sma20 && sma20 > sma50 && return30d > 1) trend = 'alta';
  else if (currentPrice < sma20 && sma20 < sma50 && return30d < -1) trend = 'baixa';

  log?.debug({ trend, sma20, sma50, return30d }, 'ibov trend computed');
  return { trend, sma20, sma50, currentPrice, return30d };
}

function avgLast(arr: number[], n: number): number {
  if (arr.length < n) return 0;
  const slice = arr.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function calcReturn(closes: number[], periods: number): number {
  if (closes.length < periods + 1) return 0;
  const first = closes[closes.length - periods - 1]!;
  const last = closes[closes.length - 1]!;
  return ((last - first) / first) * 100;
}
