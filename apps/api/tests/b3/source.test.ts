import { describe, it, expect } from 'vitest';
import { validateTicker } from '../../src/b3/source.ts';
import { B3Error } from '../../src/b3/types.ts';

describe('validateTicker', () => {
  it.each([
    'PETR4', 'VALE3', 'ITUB4', 'SANB11', 'B3SA3', 'OIBR3', 'CASH3',
    'AAPL34', 'GOOGL34', 'MSFT34',
  ])('accepts valid ticker %s', ticker => {
    expect(() => validateTicker(ticker)).not.toThrow();
  });

  it.each([
    'petr4',      // lowercase
    'PETR',       // no trailing digit
    '',           // empty
    'PETR44444',  // too long
    'P4',         // too short root
    'PETR 4',     // space
  ])('rejects invalid ticker %s', ticker => {
    expect(() => validateTicker(ticker)).toThrow(B3Error);
    try {
      validateTicker(ticker);
    } catch (e) {
      expect(e).toBeInstanceOf(B3Error);
      expect((e as B3Error).code).toBe('INVALID_TICKER');
    }
  });
});
