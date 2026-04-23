export class B3Error extends Error {
  constructor(
    public readonly code: 'TICKER_NOT_FOUND' | 'SOURCE_UNAVAILABLE' | 'ALL_SOURCES_FAILED' | 'INVALID_TICKER',
    message: string,
  ) {
    super(message);
    this.name = 'B3Error';
  }
}

export function isTickerNotFound(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'TICKER_NOT_FOUND';
}

export function isSourceUnavailable(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE';
}

export function isAllSourcesFailed(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'ALL_SOURCES_FAILED';
}

export function isInvalidTicker(e: unknown): boolean {
  return e instanceof B3Error && e.code === 'INVALID_TICKER';
}

export interface Quote {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap?: number;
  currency: string;
  updatedAt: string; // ISO 8601
  source: string;
}

export interface Fundamentals {
  ticker: string;
  pe?: number;
  pb?: number;
  dividendYield?: number;
  roe?: number;
  debtToEquity?: number;
  netMargin?: number;
  source: string;
  updatedAt: string; // ISO 8601
}
