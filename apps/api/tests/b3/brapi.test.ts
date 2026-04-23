import { describe, it, expect, afterEach } from 'vitest';
import { BrapiSource } from '../../src/b3/brapi.ts';
import { B3Error } from '../../src/b3/types.ts';
import { startServer, jsonResponse, statusResponse } from './helpers.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function quotePayload(price: number, changePct: number) {
  return {
    results: [{
      symbol: 'PETR4',
      longName: 'Petróleo Brasileiro S.A.',
      shortName: 'PETROBRAS',
      currency: 'BRL',
      regularMarketPrice: price,
      regularMarketChangePercent: changePct,
      regularMarketVolume: 10_000_000,
      marketCap: 500_000_000_000,
    }],
  };
}

function fundamentalsPayload() {
  return {
    results: [{
      symbol: 'PETR4',
      longName: 'Petróleo Brasileiro S.A.',
      currency: 'BRL',
      summaryDetail: {
        trailingPE: 7.5,
        priceToBook: 1.2,
        trailingAnnualDividendYield: 0.085,
        returnOnEquity: 0.32,
        debtToEquity: 0.65,
        profitMargins: 0.28,
      },
    }],
  };
}

describe('BrapiSource', () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  describe('quote()', () => {
    it('returns parsed quote on success', async () => {
      const srv = await startServer((_req, res) => jsonResponse(res, 200, quotePayload(38.12, 1.25)));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      const q = await src.quote('PETR4');

      expect(q.ticker).toBe('PETR4');
      expect(q.price).toBe(38.12);
      expect(q.changePct).toBe(1.25);
      expect(q.currency).toBe('BRL');
      expect(q.source).toBe('brapi');
    });

    it('throws TICKER_NOT_FOUND on 404', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 404));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      await expect(src.quote('XXXX4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'TICKER_NOT_FOUND',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 429', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 429));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 500', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 500));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws INVALID_TICKER without making HTTP call', async () => {
      let called = false;
      const srv = await startServer((_req, res) => { called = true; statusResponse(res, 200); });
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      await expect(src.quote('invalid')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'INVALID_TICKER',
      );
      expect(called).toBe(false);
    });

    it('appends token to URL when provided', async () => {
      let receivedQuery = '';
      const srv = await startServer((req, res) => {
        receivedQuery = req.url ?? '';
        jsonResponse(res, 200, quotePayload(10, 0));
      });
      close = srv.close;

      const src = new BrapiSource('mytoken123', nop, srv.url);
      await src.quote('VALE3');
      expect(receivedQuery).toContain('token=mytoken123');
    });
  });

  describe('fundamentals()', () => {
    it('converts fraction fields to percentage', async () => {
      const srv = await startServer((_req, res) => jsonResponse(res, 200, fundamentalsPayload()));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      const f = await src.fundamentals('PETR4');

      expect(f.pe).toBe(7.5);
      expect(f.dividendYield).toBeCloseTo(8.5, 1); // 0.085 * 100
      expect(f.roe).toBeCloseTo(32, 1);             // 0.32 * 100
      expect(f.pb).toBe(1.2);
    });

    it('returns undefined for missing fields', async () => {
      const partial = {
        results: [{
          symbol: 'PETR4',
          longName: 'Petróleo',
          currency: 'BRL',
          summaryDetail: { trailingPE: 7.5 },
        }],
      };
      const srv = await startServer((_req, res) => jsonResponse(res, 200, partial));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      const f = await src.fundamentals('PETR4');

      expect(f.pe).toBe(7.5);
      expect(f.dividendYield).toBeUndefined();
      expect(f.roe).toBeUndefined();
      expect(f.pb).toBeUndefined();
    });

    it('throws INVALID_TICKER for bad ticker', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 200));
      close = srv.close;

      const src = new BrapiSource('', nop, srv.url);
      await expect(src.fundamentals('bad')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'INVALID_TICKER',
      );
    });
  });
});
