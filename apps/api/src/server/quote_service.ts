import type { Source, Quote } from '../b3/source.ts';
import { validateTicker } from '../b3/source.ts';
import { B3Error } from '../b3/types.ts';

export const QUOTE_CACHE_CONTROL = 'public, max-age=60';
export const MAX_PUBLIC_BATCH_TICKERS = 20;

export interface QuoteService {
  get(ticker: string): Promise<Quote>;
  getBatch(tickers: readonly unknown[]): Promise<Record<string, Quote>>;
}

export class QuoteError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}

export function quoteErrorToHTTP(err: unknown): { status: number; message: string } {
  if (err instanceof QuoteError) {
    return { status: err.status, message: err.message };
  }
  if (err instanceof B3Error) {
    if (err.code === 'INVALID_TICKER') return { status: 400, message: 'invalid ticker format' };
    if (err.code === 'TICKER_NOT_FOUND') return { status: 404, message: 'ticker not found' };
  }
  return { status: 503, message: 'data temporarily unavailable' };
}

export function createQuoteService(source?: Source): QuoteService {
  return {
    async get(rawTicker: string): Promise<Quote> {
      if (!source) throw new QuoteError(503, 'b3 data source not configured');

      const ticker = rawTicker.toUpperCase();
      validateTicker(ticker);
      return source.quote(ticker);
    },

    async getBatch(rawTickers: readonly unknown[]): Promise<Record<string, Quote>> {
      if (!source) throw new QuoteError(503, 'b3 data source not configured');

      const validTickers: string[] = [];
      for (const rawTicker of rawTickers.slice(0, MAX_PUBLIC_BATCH_TICKERS)) {
        if (typeof rawTicker !== 'string') continue;

        const ticker = rawTicker.toUpperCase();
        try {
          validateTicker(ticker);
          validTickers.push(ticker);
        } catch {
          // Public batch lookup ignores malformed symbols and returns valid quotes.
        }
      }

      if (validTickers.length === 0) {
        throw new QuoteError(400, 'no valid tickers provided');
      }

      const results = await Promise.allSettled(
        validTickers.map(ticker => source.quote(ticker).then(quote => ({ ticker, quote }))),
      );

      const quotes: Record<string, Quote> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          quotes[result.value.ticker] = result.value.quote;
        }
      }
      return quotes;
    },
  };
}
