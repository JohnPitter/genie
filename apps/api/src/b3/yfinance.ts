import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { buildHeaders, DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './http.ts';
import type { Logger } from 'pino';

const DEFAULT_BASE_URL = 'https://query1.finance.yahoo.com';

interface RawValue {
  raw: number;
}

interface YFQuoteResult {
  symbol: string;
  longName: string;
  shortName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
}

interface YFQuoteResponse {
  quoteResponse: {
    result: YFQuoteResult[];
    error?: { code: string; description: string } | null;
  };
}

interface YFSummaryResponse {
  quoteSummary: {
    result: Array<{
      summaryDetail?: {
        trailingPE?: RawValue;
        dividendYield?: RawValue;
        priceToBook?: RawValue;
      };
      financialData?: {
        returnOnEquity?: RawValue;
        profitMargins?: RawValue;
        debtToEquity?: RawValue;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

function checkStatus(status: number, source: string): void {
  if (status === 200) return;
  if (status === 404) throw new B3Error('TICKER_NOT_FOUND', `${source}: ticker not found`);
  if (status === 429) throw new B3Error('SOURCE_UNAVAILABLE', `${source}: rate limited`);
  if (status >= 500) throw new B3Error('SOURCE_UNAVAILABLE', `${source}: HTTP ${status}`);
  throw new Error(`${source}: unexpected HTTP ${status}`);
}

export class YFinanceSource implements Source {
  constructor(
    private readonly log: Logger,
    private readonly baseURL = DEFAULT_BASE_URL,
  ) {}

  name(): string {
    return 'yfinance';
  }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);
    const t0 = Date.now();

    const symbol = `${ticker}.SA`;
    const url = `${this.baseURL}/v7/finance/quote?symbols=${symbol}`;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, buildHeaders(), DEFAULT_TIMEOUT_MS, signal);
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `yfinance: request failed: ${String(err)}`);
    }
    checkStatus(resp.status, 'yfinance');

    let payload: YFQuoteResponse;
    try {
      payload = (await resp.json()) as YFQuoteResponse;
    } catch {
      throw new B3Error('SOURCE_UNAVAILABLE', 'yfinance: failed to decode response');
    }

    if (payload.quoteResponse.error) {
      throw new B3Error('SOURCE_UNAVAILABLE', `yfinance: ${payload.quoteResponse.error.description}`);
    }
    if (!payload.quoteResponse.result?.length) {
      throw new B3Error('TICKER_NOT_FOUND', `yfinance: no results for ${ticker}`);
    }

    const r = payload.quoteResponse.result[0]!;
    const q: Quote = {
      ticker,
      name: r.longName || r.shortName,
      price: r.regularMarketPrice,
      changePct: r.regularMarketChangePercent,
      volume: r.regularMarketVolume,
      currency: r.currency,
      updatedAt: new Date().toISOString(),
      source: this.name(),
    };
    if (r.marketCap) q.marketCap = r.marketCap;

    this.log.info({ ticker, price: q.price, durationMs: Date.now() - t0 }, 'quote fetched');
    return q;
  }

  async fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals> {
    validateTicker(ticker);
    const t0 = Date.now();

    const symbol = `${ticker}.SA`;
    const url = `${this.baseURL}/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData`;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, buildHeaders(), DEFAULT_TIMEOUT_MS, signal);
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `yfinance: request failed: ${String(err)}`);
    }
    checkStatus(resp.status, 'yfinance');

    let payload: YFSummaryResponse;
    try {
      payload = (await resp.json()) as YFSummaryResponse;
    } catch {
      throw new B3Error('SOURCE_UNAVAILABLE', 'yfinance: failed to decode summary response');
    }

    if (payload.quoteSummary.error) {
      throw new B3Error('SOURCE_UNAVAILABLE', `yfinance: ${payload.quoteSummary.error.description}`);
    }
    if (!payload.quoteSummary.result?.length) {
      throw new B3Error('TICKER_NOT_FOUND', `yfinance: no summary for ${ticker}`);
    }

    const r = payload.quoteSummary.result[0]!;
    const f: Fundamentals = {
      ticker,
      source: this.name(),
      updatedAt: new Date().toISOString(),
    };

    const sd = r.summaryDetail;
    if (sd) {
      if (sd.trailingPE) f.pe = sd.trailingPE.raw;
      if (sd.priceToBook) f.pb = sd.priceToBook.raw;
      // Yahoo returns as fraction → convert to %
      if (sd.dividendYield) f.dividendYield = sd.dividendYield.raw * 100;
    }

    const fd = r.financialData;
    if (fd) {
      if (fd.returnOnEquity) f.roe = fd.returnOnEquity.raw * 100;
      if (fd.profitMargins) f.netMargin = fd.profitMargins.raw * 100;
      if (fd.debtToEquity) f.debtToEquity = fd.debtToEquity.raw;
    }

    this.log.info({ ticker, durationMs: Date.now() - t0 }, 'fundamentals fetched');
    return f;
  }
}
