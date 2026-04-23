import { describe, it, expect } from 'vitest';
import { b3QuoteTool } from '../../src/tools/b3_quote.ts';
import { b3FundamentalsTool } from '../../src/tools/b3_fundamentals.ts';
import { b3SearchTickerTool } from '../../src/tools/b3_search_ticker.ts';
import { B3Error } from '../../src/b3/types.ts';
import type { Source, Quote, Fundamentals } from '../../src/b3/source.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function makeSource(quote?: Quote, fundamentals?: Fundamentals, err?: B3Error): Source {
  return {
    name: () => 'mock',
    quote: async () => { if (err) throw err; return quote!; },
    fundamentals: async () => { if (err) throw err; return fundamentals!; },
  };
}

const SAMPLE_QUOTE: Quote = {
  ticker: 'PETR4', name: 'Petrobras', price: 38.12, changePct: 1.25,
  volume: 1000, currency: 'BRL', updatedAt: new Date().toISOString(), source: 'mock',
};

const SAMPLE_FUNDAMENTALS: Fundamentals = {
  ticker: 'PETR4', pe: 7.5, roe: 32, source: 'mock', updatedAt: new Date().toISOString(),
};

describe('b3QuoteTool', () => {
  it('returns quote on success', async () => {
    const tool = b3QuoteTool(makeSource(SAMPLE_QUOTE), nop);
    const result = await tool.handler({ ticker: 'PETR4' });
    expect(result).toMatchObject({ ticker: 'PETR4', price: 38.12 });
  });

  it('returns error object for missing ticker arg', async () => {
    const tool = b3QuoteTool(makeSource(SAMPLE_QUOTE), nop);
    const result = await tool.handler({});
    expect(result).toMatchObject({ error: expect.stringContaining('ticker') });
  });

  it('returns error object for INVALID_TICKER', async () => {
    const tool = b3QuoteTool(makeSource(undefined, undefined, new B3Error('INVALID_TICKER', 'bad')), nop);
    const result = await tool.handler({ ticker: 'BAD1' });
    expect(result).toMatchObject({ error: 'invalid ticker format' });
  });

  it('returns error object for TICKER_NOT_FOUND', async () => {
    const tool = b3QuoteTool(makeSource(undefined, undefined, new B3Error('TICKER_NOT_FOUND', 'nf')), nop);
    const result = await tool.handler({ ticker: 'AAAA4' });
    expect(result).toMatchObject({ error: 'ticker not found' });
  });

  it('returns error object for ALL_SOURCES_FAILED', async () => {
    const tool = b3QuoteTool(makeSource(undefined, undefined, new B3Error('ALL_SOURCES_FAILED', 'all')), nop);
    const result = await tool.handler({ ticker: 'PETR4' });
    expect(result).toMatchObject({ error: 'all sources unavailable' });
  });

  it('is marked concurrent', () => {
    expect(b3QuoteTool(makeSource(SAMPLE_QUOTE), nop).concurrent).toBe(true);
  });
});

describe('b3FundamentalsTool', () => {
  it('returns fundamentals on success', async () => {
    const tool = b3FundamentalsTool(makeSource(undefined, SAMPLE_FUNDAMENTALS), nop);
    const result = await tool.handler({ ticker: 'PETR4' });
    expect(result).toMatchObject({ ticker: 'PETR4', pe: 7.5 });
  });

  it('returns error object for missing ticker', async () => {
    const tool = b3FundamentalsTool(makeSource(undefined, SAMPLE_FUNDAMENTALS), nop);
    const result = await tool.handler({});
    expect(result).toMatchObject({ error: expect.stringContaining('ticker') });
  });
});

describe('b3SearchTickerTool', () => {
  it('returns tickers matching prefix', async () => {
    const tool = b3SearchTickerTool();
    const result = await tool.handler({ query: 'PETR' }) as Array<{ ticker: string }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result.some(r => r.ticker === 'PETR4')).toBe(true);
  });

  it('returns error object for empty query', async () => {
    const tool = b3SearchTickerTool();
    const result = await tool.handler({ query: '' });
    expect(result).toMatchObject({ error: expect.stringContaining('query') });
  });

  it('returns tickers with category', async () => {
    const tool = b3SearchTickerTool();
    const result = await tool.handler({ query: 'VALE' }) as Array<{ ticker: string; category: string }>;
    const vale = result.find(r => r.ticker === 'VALE3');
    expect(vale?.category).toBe('commodities');
  });
});
