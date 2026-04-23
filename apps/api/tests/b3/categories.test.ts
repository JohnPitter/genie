import { describe, it, expect } from 'vitest';
import {
  tickersFor,
  categoryOf,
  allTickers,
  searchTickers,
  ALL_CATEGORIES,
} from '../../src/b3/categories.ts';

describe('tickersFor', () => {
  it('returns tickers for known category', () => {
    const tickers = tickersFor('financeiro');
    expect(tickers.length).toBeGreaterThan(0);
    expect(tickers).toContain('ITUB4');
  });

  it('returns empty array for unknown category', () => {
    // @ts-expect-error — intentionally invalid category
    expect(tickersFor('unknown')).toEqual([]);
  });
});

describe('categoryOf', () => {
  it('returns correct category for known ticker', () => {
    expect(categoryOf('PETR4')).toBe('commodities');
    expect(categoryOf('ITUB4')).toBe('financeiro');
    expect(categoryOf('VALE3')).toBe('commodities');
    expect(categoryOf('SBSP3')).toBe('saneamento');
  });

  it('is case-insensitive', () => {
    expect(categoryOf('petr4')).toBe('commodities');
  });

  it('returns undefined for unknown ticker', () => {
    expect(categoryOf('UNKNOWN')).toBeUndefined();
  });
});

describe('allTickers', () => {
  it('contains no duplicates', () => {
    const all = allTickers();
    const unique = new Set(all);
    expect(all.length).toBe(unique.size);
  });

  it('contains tickers from all categories', () => {
    const all = new Set(allTickers());
    for (const cat of ALL_CATEGORIES) {
      for (const t of tickersFor(cat)) {
        expect(all.has(t), `${t} from ${cat} should be in allTickers`).toBe(true);
      }
    }
  });
});

describe('searchTickers', () => {
  it('returns all tickers for empty query', () => {
    expect(searchTickers('')).toEqual(allTickers());
  });

  it('returns tickers with matching prefix', () => {
    const results = searchTickers('PETR');
    expect(results).toContain('PETR4');
    expect(results).toContain('PETR3');
    expect(results.every(t => t.startsWith('PETR'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(searchTickers('petr')).toEqual(searchTickers('PETR'));
  });

  it('returns empty array for non-matching prefix', () => {
    expect(searchTickers('ZZZZZ')).toHaveLength(0);
  });
});
