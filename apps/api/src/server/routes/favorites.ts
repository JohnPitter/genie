import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { validateTicker } from '../../b3/source.ts';
import { addFavorite, removeFavorite, listFavorites, isFavorite } from '../../store/favorites.ts';
import { listByTicker } from '../../store/news.ts';

export async function registerFavoritesRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get<{ Querystring: { enrich?: string } }>('/api/favorites', async (req, reply) => {
    const favs = listFavorites(deps.db);
    const enrich = req.query.enrich?.toLowerCase() === 'true';

    if (!enrich || !deps.b3) {
      return reply.send(favs);
    }

    // Enriched: fetch quote + news concurrently per ticker
    const enriched = await Promise.all(
      favs.map(async f => {
        const [quote, news] = await Promise.allSettled([
          deps.b3!.quote(f.ticker),
          Promise.resolve(listByTicker(deps.db, f.ticker, 10)),
        ]);

        const articles = news.status === 'fulfilled' ? news.value : [];
        return {
          ...f,
          quote: quote.status === 'fulfilled' ? quote.value : null,
          newsCount: articles.length,
          latestNews: articles[0] ?? null,
        };
      }),
    );

    return reply.send(enriched);
  });

  app.post<{ Body: { ticker?: string } }>('/api/favorites', async (req, reply) => {
    const ticker = (req.body?.ticker ?? '').toUpperCase().trim();
    try {
      validateTicker(ticker);
    } catch {
      return reply.status(400).send({ error: 'invalid ticker format' });
    }

    const exists = isFavorite(deps.db, ticker);
    addFavorite(deps.db, ticker);

    if (exists) {
      return reply.send({ ticker, status: 'already_favorited' });
    }
    return reply.status(201).send({ ticker, status: 'added' });
  });

  app.delete<{ Params: { ticker: string } }>('/api/favorites/:ticker', async (req, reply) => {
    const ticker = req.params.ticker.toUpperCase().trim();
    try {
      validateTicker(ticker);
    } catch {
      return reply.status(400).send({ error: 'invalid ticker format' });
    }

    removeFavorite(deps.db, ticker);
    return reply.status(204).send();
  });
}
