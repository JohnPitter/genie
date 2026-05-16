import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppDeps } from '../app.ts';
import { QUOTE_CACHE_CONTROL, createQuoteService, quoteErrorToHTTP } from '../quote_service.ts';

const PUBLIC_CORS_ORIGIN = '*';
const PUBLIC_CORS_METHODS = 'GET, OPTIONS';
const PUBLIC_RATE_LIMIT_MAX = 30;
const PUBLIC_RATE_LIMIT_WINDOW = '1 minute';
const QUERY_TICKER_SEPARATOR = ',';

function applyPublicQuoteHeaders(reply: FastifyReply): FastifyReply {
  return reply
    .header('Access-Control-Allow-Origin', PUBLIC_CORS_ORIGIN)
    .header('Access-Control-Allow-Methods', PUBLIC_CORS_METHODS)
    .header('Cache-Control', QUOTE_CACHE_CONTROL);
}

function parseTickersParam(tickers?: string): string[] {
  return (tickers ?? '')
    .split(QUERY_TICKER_SEPARATOR)
    .map(ticker => ticker.trim())
    .filter(Boolean);
}

export async function registerPublicQuoteRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const quotes = createQuoteService(deps.b3);
  const routeConfig = {
    rateLimit: { max: PUBLIC_RATE_LIMIT_MAX, timeWindow: PUBLIC_RATE_LIMIT_WINDOW },
  };

  app.get<{ Params: { ticker: string } }>('/api/public/quotes/:ticker', {
    config: routeConfig,
  }, async (req, reply) => {
    try {
      const quote = await quotes.get(req.params.ticker);
      return applyPublicQuoteHeaders(reply).send(quote);
    } catch (err) {
      const { status, message } = quoteErrorToHTTP(err);
      return applyPublicQuoteHeaders(reply).status(status).send({ error: message });
    }
  });

  app.get<{ Querystring: { tickers?: string } }>('/api/public/quotes', {
    config: routeConfig,
  }, async (req, reply) => {
    const tickers = parseTickersParam(req.query.tickers);
    if (tickers.length === 0) {
      return applyPublicQuoteHeaders(reply).status(400).send({ error: 'query param tickers is required' });
    }

    try {
      const batch = await quotes.getBatch(tickers);
      return applyPublicQuoteHeaders(reply).send(batch);
    } catch (err) {
      const { status, message } = quoteErrorToHTTP(err);
      return applyPublicQuoteHeaders(reply).status(status).send({ error: message });
    }
  });
}
