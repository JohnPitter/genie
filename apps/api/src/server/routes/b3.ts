import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { validateTicker } from '../../b3/source.ts';
import { searchTickers, categoryOf, allTickers, ALL_CATEGORIES, tickersFor } from '../../b3/categories.ts';
import { QUOTE_CACHE_CONTROL, createQuoteService, quoteErrorToHTTP } from '../quote_service.ts';

const INTERNAL_BATCH_RATE_LIMIT_MAX = 30;
const INTERNAL_BATCH_RATE_LIMIT_WINDOW = '1 minute';

export async function registerB3Routes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const quotes = createQuoteService(deps.b3);

  app.get<{ Params: { ticker: string } }>('/api/b3/quote/:ticker', async (req, reply) => {
    try {
      const quote = await quotes.get(req.params.ticker);
      return reply.send(quote);
    } catch (err) {
      const { status, message } = quoteErrorToHTTP(err);
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
      const { status, message } = quoteErrorToHTTP(err);
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

  app.post<{ Body: { tickers: unknown } }>('/api/b3/quotes/batch', {
    config: { rateLimit: { max: INTERNAL_BATCH_RATE_LIMIT_MAX, timeWindow: INTERNAL_BATCH_RATE_LIMIT_WINDOW } },
  }, async (req, reply) => {
    const { tickers } = req.body;
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return reply.status(400).send({ error: 'body must contain a non-empty tickers array' });
    }

    try {
      const batch = await quotes.getBatch(tickers);
      return reply.header('Cache-Control', QUOTE_CACHE_CONTROL).send(batch);
    } catch (err) {
      const { status, message } = quoteErrorToHTTP(err);
      return reply.status(status).send({ error: message });
    }
  });
}
