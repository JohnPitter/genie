import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { buildHeaders, DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './http.ts';
import type { Logger } from 'pino';

const DEFAULT_BASE_URL = 'https://brapi.dev';

interface BrapiResult {
  symbol: string;
  longName: string;
  shortName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
  summaryDetail?: {
    priceToBook?: number;
    trailingAnnualDividendYield?: number;
    returnOnEquity?: number;
    trailingPE?: number;
    debtToEquity?: number;
    profitMargins?: number;
  };
}

interface BrapiResponse {
  results: BrapiResult[];
}

export class BrapiSource implements Source {
  constructor(
    private readonly token: string,
    private readonly log: Logger,
    private readonly baseURL = DEFAULT_BASE_URL,
  ) {}

  name(): string {
    return 'brapi';
  }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);
    const t0 = Date.now();

    let url = `${this.baseURL}/api/quote/${ticker}`;
    if (this.token) url += `?token=${this.token}`;

    const result = await this.fetchResult(url, signal);
    const q: Quote = {
      ticker,
      name: result.longName || result.shortName,
      price: result.regularMarketPrice,
      changePct: result.regularMarketChangePercent,
      volume: result.regularMarketVolume,
      currency: result.currency,
      updatedAt: new Date().toISOString(),
      source: this.name(),
    };
    if (result.marketCap) q.marketCap = result.marketCap;

    this.log.info({ ticker, price: q.price, durationMs: Date.now() - t0 }, 'quote fetched');
    return q;
  }

  async fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals> {
    validateTicker(ticker);
    const t0 = Date.now();

    let url = `${this.baseURL}/api/quote/${ticker}?fundamental=true`;
    if (this.token) url += `&token=${this.token}`;

    const result = await this.fetchResult(url, signal);
    const f: Fundamentals = {
      ticker,
      source: this.name(),
      updatedAt: new Date().toISOString(),
    };

    const sd = result.summaryDetail;
    if (sd) {
      if (sd.trailingPE !== undefined) f.pe = sd.trailingPE;
      if (sd.priceToBook !== undefined) f.pb = sd.priceToBook;
      if (sd.debtToEquity !== undefined) f.debtToEquity = sd.debtToEquity;
      if (sd.profitMargins !== undefined) f.netMargin = sd.profitMargins;
      // Brapi returns as fraction (0.085) → convert to %
      if (sd.trailingAnnualDividendYield !== undefined) f.dividendYield = sd.trailingAnnualDividendYield * 100;
      if (sd.returnOnEquity !== undefined) f.roe = sd.returnOnEquity * 100;
    }

    this.log.info({ ticker, durationMs: Date.now() - t0 }, 'fundamentals fetched');
    return f;
  }

  private async fetchResult(url: string, signal?: AbortSignal): Promise<BrapiResult> {
    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, buildHeaders(), DEFAULT_TIMEOUT_MS, signal);
    } catch (err) {
      throw new B3Error('SOURCE_UNAVAILABLE', `brapi: request failed: ${String(err)}`);
    }

    switch (resp.status) {
      case 200: break;
      case 404: throw new B3Error('TICKER_NOT_FOUND', 'brapi: ticker not found');
      case 429: throw new B3Error('SOURCE_UNAVAILABLE', 'brapi: rate limited');
      default:
        if (resp.status >= 500) throw new B3Error('SOURCE_UNAVAILABLE', `brapi: HTTP ${resp.status}`);
        throw new Error(`brapi: unexpected HTTP ${resp.status}`);
    }

    let payload: BrapiResponse;
    try {
      payload = (await resp.json()) as BrapiResponse;
    } catch {
      throw new B3Error('SOURCE_UNAVAILABLE', 'brapi: failed to decode response');
    }

    if (!payload.results?.length) {
      throw new B3Error('TICKER_NOT_FOUND', 'brapi: empty results array');
    }

    const r = payload.results[0]!;
    r.symbol = r.symbol.replace(/\.SA$/, '');
    return r;
  }
}
