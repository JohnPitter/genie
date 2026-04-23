import { buildHeaders, fetchWithTimeout } from './http.ts';
import type { HistoryPoint } from './types.ts';
import type { Logger } from 'pino';

const BASE_URL = 'https://query2.finance.yahoo.com';
const TIMEOUT_MS = 20_000;

interface YFChartResult {
  meta: {
    regularMarketPrice: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    longName?: string;
    shortName?: string;
    regularMarketChangePercent?: number;
    previousClose?: number;
  };
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: number[];
      high: number[];
      low: number[];
      close: number[];
      volume: number[];
    }>;
  };
}

interface YFChartResponse {
  chart: {
    result: YFChartResult[] | null;
    error?: { code: string; description: string } | null;
  };
}

export interface HistoryResult {
  name: string;
  currentPrice: number;
  changePct: number;
  high52w: number;
  low52w: number;
  history: HistoryPoint[];
}

export async function fetchHistory(
  ticker: string,
  rangeDays = 90,
  signal?: AbortSignal,
  log?: Logger,
): Promise<HistoryResult> {
  const symbol = `${ticker}.SA`;
  const range = rangeDays <= 30 ? '1mo' : rangeDays <= 90 ? '3mo' : '6mo';
  const url = `${BASE_URL}/v8/finance/chart/${symbol}?interval=1d&range=${range}`;

  const resp = await fetchWithTimeout(url, buildHeaders(), TIMEOUT_MS, signal);

  if (resp.status === 404) throw new Error(`history: ticker not found: ${ticker}`);
  if (!resp.ok) throw new Error(`history: HTTP ${resp.status} from Yahoo Finance`);

  const data = (await resp.json()) as YFChartResponse;

  if (data.chart.error) {
    throw new Error(`history: ${data.chart.error.description}`);
  }
  if (!data.chart.result?.length) {
    throw new Error(`history: no data for ${ticker}`);
  }

  const result = data.chart.result[0]!;
  const quote = result.indicators.quote[0]!;
  const timestamps = result.timestamp;
  const closes = quote.close;
  const prevClose = result.meta.previousClose ?? closes[closes.length - 2] ?? closes[closes.length - 1]!;
  const currentPrice = result.meta.regularMarketPrice;
  const changePct = ((currentPrice - prevClose) / prevClose) * 100;

  const history: HistoryPoint[] = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: quote.open[i] ?? 0,
      high: quote.high[i] ?? 0,
      low: quote.low[i] ?? 0,
      close: quote.close[i] ?? 0,
      volume: quote.volume[i] ?? 0,
    }))
    .filter(p => p.close > 0);

  log?.debug({ ticker, points: history.length }, 'history fetched');

  return {
    name: result.meta.longName ?? result.meta.shortName ?? ticker,
    currentPrice,
    changePct,
    high52w: result.meta.fiftyTwoWeekHigh,
    low52w: result.meta.fiftyTwoWeekLow,
    history,
  };
}
