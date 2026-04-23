import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server/app.ts';
import { openTestDB } from '../store/helpers.ts';
import type { DB } from '../../src/store/db.ts';
import type { FastifyInstance } from 'fastify';
import pino from 'pino';

const nop = pino({ level: 'silent' });
let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openTestDB();
  app = await buildApp({ db, log: nop });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeTruthy();
    expect(body.db).toBe('ok');
  });
});

describe('GET /api/config', () => {
  it('returns 200 with version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBeTruthy();
  });
});

describe('GET /api/b3/categories', () => {
  it('returns all 7 categories', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/b3/categories' });
    expect(res.statusCode).toBe(200);
    const cats = res.json() as Array<{ category: string; tickers: string[] }>;
    expect(cats).toHaveLength(7);
    expect(cats.map(c => c.category)).toContain('financeiro');
  });
});

describe('GET /api/b3/search', () => {
  it('returns 400 if q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/b3/search' });
    expect(res.statusCode).toBe(400);
  });

  it('returns matching tickers for ?q=PETR', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/b3/search?q=PETR' });
    expect(res.statusCode).toBe(200);
    const items = res.json() as Array<{ ticker: string }>;
    expect(items.some(i => i.ticker === 'PETR4')).toBe(true);
  });
});

describe('GET /api/b3/quote/:ticker without b3 dep', () => {
  it('returns 503 when b3 source is not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/b3/quote/PETR4' });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /api/b3/quote/:ticker with b3 dep', () => {
  it('returns quote from configured source', async () => {
    const mockB3 = {
      name: () => 'mock',
      quote: async (ticker: string) => ({
        ticker, name: 'Petrobras', price: 38.12, changePct: 1.25,
        volume: 0, currency: 'BRL', updatedAt: new Date().toISOString(), source: 'mock',
      }),
      fundamentals: async (ticker: string) => ({ ticker, source: 'mock', updatedAt: new Date().toISOString() }),
    };

    const appWithB3 = await buildApp({ db, log: nop, b3: mockB3 });
    await appWithB3.ready();

    const res = await appWithB3.inject({ method: 'GET', url: '/api/b3/quote/PETR4' });
    expect(res.statusCode).toBe(200);
    expect(res.json().price).toBe(38.12);

    await appWithB3.close();
  });

  it('returns 400 for invalid ticker format', async () => {
    const mockB3 = {
      name: () => 'mock',
      quote: async () => { throw new Error('should not call'); },
      fundamentals: async () => { throw new Error('should not call'); },
    };
    const appWithB3 = await buildApp({ db, log: nop, b3: mockB3 });
    await appWithB3.ready();

    const res = await appWithB3.inject({ method: 'GET', url: '/api/b3/quote/invalid' });
    expect(res.statusCode).toBe(400);

    await appWithB3.close();
  });
});

describe('Favorites API', () => {
  it('POST /api/favorites adds a ticker', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/favorites',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticker: 'PETR4' }),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('added');
  });

  it('POST /api/favorites is idempotent', async () => {
    await app.inject({ method: 'POST', url: '/api/favorites', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: 'VALE3' }) });
    const res = await app.inject({ method: 'POST', url: '/api/favorites', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: 'VALE3' }) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('already_favorited');
  });

  it('GET /api/favorites returns favorites list', async () => {
    await app.inject({ method: 'POST', url: '/api/favorites', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: 'ITUB4' }) });
    const res = await app.inject({ method: 'GET', url: '/api/favorites' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ ticker: string }>;
    expect(list.some(f => f.ticker === 'ITUB4')).toBe(true);
  });

  it('DELETE /api/favorites/:ticker removes ticker', async () => {
    await app.inject({ method: 'POST', url: '/api/favorites', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticker: 'BBAS3' }) });
    const del = await app.inject({ method: 'DELETE', url: '/api/favorites/BBAS3' });
    expect(del.statusCode).toBe(204);

    const res = await app.inject({ method: 'GET', url: '/api/favorites' });
    const list = res.json() as Array<{ ticker: string }>;
    expect(list.some(f => f.ticker === 'BBAS3')).toBe(false);
  });

  it('POST /api/favorites returns 400 for invalid ticker', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/favorites',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticker: 'invalid' }),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/news', () => {
  it('returns 503 when news service is not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?category=financeiro' });
    expect(res.statusCode).toBe(503);
  });

  it('returns 400 when neither category nor ticker provided', async () => {
    // Mock newsSvc to enable the route
    const mockSvc = {
      byCategory: async () => [],
      byTicker: async () => [],
      stop: () => {},
    };
    // Use a fresh app with newsSvc attached
    const appWithNews = await buildApp({ db, log: nop, newsSvc: mockSvc as never });
    await appWithNews.ready();

    const res = await appWithNews.inject({ method: 'GET', url: '/api/news' });
    expect(res.statusCode).toBe(400);

    await appWithNews.close();
  });
});
