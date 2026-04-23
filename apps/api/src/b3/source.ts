import { B3Error } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';

export type { Quote, Fundamentals };

const TICKER_REGEX = /^[A-Z0-9]{2,6}[0-9]{1,2}$/;

export function validateTicker(ticker: string): void {
  if (!TICKER_REGEX.test(ticker)) {
    throw new B3Error('INVALID_TICKER', `b3: invalid ticker format: "${ticker}" does not match pattern`);
  }
}

export interface Source {
  name(): string;
  quote(ticker: string, signal?: AbortSignal): Promise<Quote>;
  fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals>;
}
