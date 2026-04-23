import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StatusInvestScraper, parseBrazilianFloat } from '../../src/b3/statusinvest.ts';
import { B3Error } from '../../src/b3/types.ts';
import { startServer, statusResponse } from './helpers.ts';
import type { ServerResponse } from 'node:http';
import pino from 'pino';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nop = pino({ level: 'silent' });
const PETR4_HTML = readFileSync(join(__dirname, 'fixtures/statusinvest_petr4.html'), 'utf-8');

function htmlResponse(res: ServerResponse, html: string): void {
  const buf = Buffer.from(html, 'utf-8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
}

describe('parseBrazilianFloat', () => {
  it.each([
    ['7,50', 7.50],
    ['8,50%', 8.50],
    ['+1,25', 1.25],
    ['-0,75', -0.75],
    ['32,00%', 32.00],
    ['0,65', 0.65],
    ['1.234,56', 1234.56],
  ])('parses "%s" → %f', (input, expected) => {
    expect(parseBrazilianFloat(input)).toBeCloseTo(expected, 2);
  });

  it('returns null for non-numeric input', () => {
    expect(parseBrazilianFloat('invalid')).toBeNull();
    expect(parseBrazilianFloat('-')).toBeNull();
  });
});

describe('StatusInvestScraper', () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  describe('quote()', () => {
    it('parses price and change from PETR4 fixture', async () => {
      const srv = await startServer((_req, res) => htmlResponse(res, PETR4_HTML));
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      const q = await src.quote('PETR4');

      expect(q.ticker).toBe('PETR4');
      expect(q.price).toBe(38.12);
      expect(q.changePct).toBe(1.25);
      expect(q.currency).toBe('BRL');
      expect(q.source).toBe('statusinvest');
      expect(q.name).toBeTruthy();
    });

    it('requests URL with lowercase ticker', async () => {
      let path = '';
      const srv = await startServer((req, res) => {
        path = req.url ?? '';
        htmlResponse(res, PETR4_HTML);
      });
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      await src.quote('PETR4');
      expect(path).toBe('/acoes/petr4');
    });

    it('throws TICKER_NOT_FOUND on 404', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 404));
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      await expect(src.quote('XXXX4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'TICKER_NOT_FOUND',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 429', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 429));
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws SOURCE_UNAVAILABLE on 500', async () => {
      const srv = await startServer((_req, res) => statusResponse(res, 500));
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      await expect(src.quote('PETR4')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'SOURCE_UNAVAILABLE',
      );
    });

    it('throws INVALID_TICKER without HTTP call', async () => {
      let called = false;
      const srv = await startServer((_req, res) => { called = true; statusResponse(res, 200); });
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      await expect(src.quote('bad')).rejects.toSatisfy(
        (e: unknown) => e instanceof B3Error && e.code === 'INVALID_TICKER',
      );
      expect(called).toBe(false);
    });
  });

  describe('fundamentals()', () => {
    it('extracts P/L, P/VP, DY, ROE from PETR4 fixture', async () => {
      const srv = await startServer((_req, res) => htmlResponse(res, PETR4_HTML));
      close = srv.close;

      const src = new StatusInvestScraper(nop, srv.url);
      const f = await src.fundamentals('PETR4');

      expect(f.ticker).toBe('PETR4');
      expect(f.source).toBe('statusinvest');
      expect(f.pe).toBeCloseTo(7.50, 2);
      expect(f.pb).toBeCloseTo(1.20, 2);
      expect(f.dividendYield).toBeCloseTo(8.50, 2);
      expect(f.roe).toBeCloseTo(32.00, 2);
    });
  });
});
