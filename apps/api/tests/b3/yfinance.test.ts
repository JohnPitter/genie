import { describe, it, expect, afterEach } from 'vitest';
import { YFinanceSource } from '../../src/b3/yfinance.ts';
import { B3Error } from '../../src/b3/types.ts';
import { startServer, jsonResponse, statusResponse } from './helpers.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function quotePayload(price: number, changePct: number) {
  return {
    quoteResponse: {
      result: [{
        symbol: 'PETR4.SA',
        longName: 'Petróleo Brasileiro S.A.',
        shortName: 'PETROBRAS',
        currency: 'BRL',
        regularMarketPrice: price,
        regularMarketChangePercent: changePct,
        regularMarketVolume: 10_000_000,
        marketCap: 500_000_000_000,
      }],
      error: null,
    },
  };
}

function summaryPayload() {
  return {
    quoteSummary: {
      result: [{
        summaryDetail: {
          trailingPE: { raw: 7.5, fmt: '7.50' },
          dividendYield: { raw: 0.085, fmt: '8.5%' },
          priceToBook: { raw: 1.2, fmt: '1.20' },
        },
        financialData: {
          returnOnEquity: { raw: 0.32, fmt: '32%' },
          profitMargins: { raw: 0.28, fmt: '28%' },
          debtToEquity: { raw: 0.65, fmt: '0.65' },
        },
      }],
      error: null,
    },
  };
}

describe('YFinanceSource', () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  describe('quote()', () => {
    it('returns parsed quote on success', async () => {
      const srv = await startServer((_req, res) => jsonResponse(res, 200, quotePayload(38.12, 1.25)));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      const q = await src.quote('PETR4');

      expect(q.ticker).toBe('PETR4');
      expect(q.price).toBe(38.12);
      expect(q.changePct).toBe(1.25);
      expect(q.currency).toBe('BRL');
      expect(q.source).toBe('yfinance');
    });

    it('appends .SA suffix to the symbol in the URL', async () => {
      let receivedUrl = '';
      const srv = await startServer((req, res) => {
        receivedUrl = req.url ?? '';
        jsonResponse(res, 200, quotePayload(10, 0));
      });
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      await src.quote('VALE3');
      expect(receivedUrl).toContain('VALE3.SA');
    });

    it('throws TICKER_NOT_FOUND on 404', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 404));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      await expect(src.quote('XXXX4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'TICKER_NOT_FOUND',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 429', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 429));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 500', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 500));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws INVALID_TICKER without HTTP call', async () => {
      let called = false;
      const srv = await startServer((_req, res) => { called = true; statusResponse(res, 200); });
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      await expect(src.quote('bad')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'INVALID_TICKER',
      );
      expect(called).toBe(false);
    });
  });

  describe('fundamentals()', () => {
    it('converts fraction fields to percentage', async () => {
      const srv = await startServer((_req, res) => jsonResponse(res, 200, summaryPayload()));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      const f = await src.fundamentals('PETR4');

      expect(f.pe).toBe(7.5);
      expect(f.dividendYield).toBeCloseTo(8.5, 1);
      expect(f.roe).toBeCloseTo(32, 1);
      expect(f.pb).toBe(1.2);
      expect(f.netMargin).toBeCloseTo(28, 1);
      expect(f.debtToEquity).toBe(0.65);
    });

    it('returns undefined for missing fields', async () => {
      const partial = {
        quoteSummary: {
          result: [{ summaryDetail: { trailingPE: { raw: 7.5 } } }],
          error: null,
        },
      };
      const srv = await startServer((_req, res) => jsonResponse(res, 200, partial));
      close = srv.close;

      const src = new YFinanceSource(nop, srv.url);
      const f = await src.fundamentals('PETR4');

      expect(f.pe).toBe(7.5);
      expect(f.dividendYield).toBeUndefined();
      expect(f.roe).toBeUndefined();
    });
  });
});
