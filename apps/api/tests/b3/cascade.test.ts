import { describe, it, expect } from 'vitest';
import { Cascade } from '../../src/b3/cascade.ts';
import { B3Error } from '../../src/b3/types.ts';
import type { Source, Quote, Fundamentals } from '../../src/b3/source.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function makeQuote(ticker: string, source: string): Quote {
  return { ticker, name: ticker, price: 38.12, changePct: 1.25, volume: 1000, currency: 'BRL', updatedAt: new Date().toISOString(), source };
}

function stubSource(name: string, quoteResult: Quote | Error, fundamentalsResult?: Fundamentals | Error): Source {
  return {
    name: () => name,
    quote: async (_ticker, _signal) => {
      if (quoteResult instanceof Error) throw quoteResult;
      return quoteResult;
    },
    fundamentals: async (ticker, _signal) => {
      if (!fundamentalsResult) return { ticker, source: name, updatedAt: new Date().toISOString() };
      if (fundamentalsResult instanceof Error) throw fundamentalsResult;
      return fundamentalsResult;
    },
  };
}

describe('Cascade', () => {
  it('returns result from first source when it succeeds', async () => {
    const src1 = stubSource('s1', makeQuote('PETR4', 's1'));
    const src2 = stubSource('s2', makeQuote('PETR4', 's2'));

    const c = new Cascade([src1, src2], nop);
    const q = await c.quote('PETR4');
    expect(q.source).toBe('s1');
    c.stop();
  });

  it('falls back to second source when first fails', async () => {
    const src1 = stubSource('s1', new B3Error('SOURCE_UNAVAILABLE', 'unavailable'));
    const src2 = stubSource('s2', makeQuote('PETR4', 's2'));

    const c = new Cascade([src1, src2], nop);
    const q = await c.quote('PETR4');
    expect(q.source).toBe('s2');
    c.stop();
  });

  it('throws ALL_SOURCES_FAILED when all sources fail', async () => {
    const err = new B3Error('SOURCE_UNAVAILABLE', 'unavailable');
    const c = new Cascade([stubSource('s1', err), stubSource('s2', err)], nop);

    await expect(c.quote('PETR4')).rejects.toSatisfy(
      (e: unknown) => e instanceof B3Error && e.code === 'ALL_SOURCES_FAILED',
    );
    c.stop();
  });

  it('caches quote on second call', async () => {
    let callCount = 0;
    const src: Source = {
      name: () => 'counting',
      quote: async (ticker) => { callCount++; return makeQuote(ticker, 'counting'); },
      fundamentals: async (ticker) => ({ ticker, source: 'counting', updatedAt: new Date().toISOString() }),
    };

    const c = new Cascade([src], nop);
    await c.quote('PETR4');
    await c.quote('PETR4');
    expect(callCount).toBe(1); // second call served from cache
    c.stop();
  });

  it('skips open circuit breaker and falls back', async () => {
    const err = new B3Error('SOURCE_UNAVAILABLE', 'unavailable');
    const src1 = stubSource('s1', err);
    const src2 = stubSource('s2', makeQuote('PETR4', 's2'));

    const c = new Cascade([src1, src2], nop);

    // Trigger 3 failures to open circuit for s1
    for (let i = 0; i < 3; i++) {
      try { await c.quote('VALE3'); } catch { /* expected */ }
    }

    // Now s1's circuit is open — should go straight to s2
    const q = await c.quote('PETR4');
    expect(q.source).toBe('s2');
    c.stop();
  });

  it('throws INVALID_TICKER without calling any source', async () => {
    let called = false;
    const src: Source = {
      name: () => 's1',
      quote: async () => { called = true; return makeQuote('X', 's1'); },
      fundamentals: async (ticker) => ({ ticker, source: 's1', updatedAt: new Date().toISOString() }),
    };

    const c = new Cascade([src], nop);
    await expect(c.quote('invalid')).rejects.toSatisfy(
      (e: unknown) => e instanceof B3Error && e.code === 'INVALID_TICKER',
    );
    expect(called).toBe(false);
    c.stop();
  });
});
