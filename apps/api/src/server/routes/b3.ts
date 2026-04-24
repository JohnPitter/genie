import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { validateTicker } from '../../b3/source.ts';
import { B3Error } from '../../b3/types.ts';
import { searchTickers, categoryOf, allTickers, ALL_CATEGORIES, tickersFor } from '../../b3/categories.ts';

function b3ErrorToHTTP(err: unknown): { status: number; message: string } {
  if (err instanceof B3Error) {
    if (err.code === 'INVALID_TICKER') return { status: 400, message: 'invalid ticker format' };
    if (err.code === 'TICKER_NOT_FOUND') return { status: 404, message: 'ticker not found' };
  }
  return { status: 503, message: 'data temporarily unavailable' };
}

export async function registerB3Routes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get<{ Params: { ticker: string } }>('/api/b3/quote/:ticker', async (req, reply) => {
    if (!deps.b3) return reply.status(503).send({ error: 'b3 data source not configured' });

    const ticker = req.params.ticker.toUpperCase();
    try {
      validateTicker(ticker);
    } catch (e) {
      return reply.status(400).send({ error: 'invalid ticker format' });
    }

    try {
      const quote = await deps.b3.quote(ticker);
      return reply.send(quote);
    } catch (err) {
      const { status, message } = b3ErrorToHTTP(err);
      return reply.status(status).send({ error: message });
    }
  });

  app.get<{ Params: { ticker: string } }>('/api/b3/fundamentals/:ticker', async (req, reply) => {
    if (!deps.b3) return reply.status(503).send({ error: 'b3 data source not configured' });

    const ticker = req.params.ticker.toUpperCase();
    try {
      validateTicker(ticker);
    } catch {
      return reply.status(400).send({ error: 'invalid ticker format' });
    }

    try {
      const f = await deps.b3.fundamentals(ticker);
      return reply.send(f);
    } catch (err) {
      const { status, message } = b3ErrorToHTTP(err);
      return reply.status(status).send({ error: message });
    }
  });

  app.get<{ Querystring: { q?: string } }>('/api/b3/search', async (req, reply) => {
    const q = req.query.q;
    if (!q) return reply.status(400).send({ error: 'query param q is required' });

    const tickers = q ? searchTickers(q) : allTickers();
    const items = tickers.map(t => ({ ticker: t, category: categoryOf(t) ?? '' }));
    return reply.send(items);
  });

  app.get('/api/b3/categories', async (_req, reply) => {
    const result = ALL_CATEGORIES.map(cat => ({ category: cat, tickers: tickersFor(cat) }));
    return reply.send(result);
  });

  app.post<{ Body: { tickers: unknown } }>('/api/b3/quotes/batch', async (req, reply) => {
    if (!deps.b3) return reply.status(503).send({ error: 'b3 data source not configured' });

    const { tickers } = req.body;
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return reply.status(400).send({ error: 'body must contain a non-empty tickers array' });
    }

    const validTickers: string[] = [];
    for (const t of tickers.slice(0, 20)) {
      if (typeof t !== 'string') continue;
      const upper = t.toUpperCase();
      try {
        validateTicker(upper);
        validTickers.push(upper);
      } catch {
        // silently skip invalid tickers
      }
    }

    if (validTickers.length === 0) {
      return reply.status(400).send({ error: 'no valid tickers provided' });
    }

    const results = await Promise.allSettled(
      validTickers.map(ticker => deps.b3!.quote(ticker).then(quote => ({ ticker, quote }))),
    );

    const quotes: Record<string, unknown> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        quotes[result.value.ticker] = result.value.quote;
      }
    }

    return reply.header('Cache-Control', 'public, max-age=60').send(quotes);
  });
}
