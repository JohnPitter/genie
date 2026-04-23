import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';

const DEFAULT_LIMIT = 20;

export async function registerNewsRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get<{ Querystring: { category?: string; ticker?: string; limit?: string } }>(
    '/api/news',
    async (req, reply) => {
      if (!deps.newsSvc) return reply.status(503).send({ error: 'news service not available' });

      const { category, ticker, limit: limitStr } = req.query;
      let limit = DEFAULT_LIMIT;
      if (limitStr) {
        const n = parseInt(limitStr, 10);
        if (isNaN(n) || n <= 0) return reply.status(400).send({ error: 'limit must be a positive integer' });
        limit = n;
      }

      if (!category && !ticker) {
        return reply.status(400).send({ error: 'must provide category or ticker' });
      }

      try {
        if (category) {
          const articles = await deps.newsSvc.byCategory(category, limit);
          return reply.send(articles ?? []);
        }
        const articles = await deps.newsSvc.byTicker(ticker!, limit);
        return reply.send(articles ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'failed to fetch news';
        return reply.status(400).send({ error: msg });
      }
    },
  );
}
