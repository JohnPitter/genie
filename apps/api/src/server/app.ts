import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { DB } from '../store/db.ts';
import type { Source } from '../b3/source.ts';
import type { NewsService } from '../news/service.ts';
import type { QueryLoop } from '../agent/loop.ts';
import type { DailyFavoritesJob } from '../jobs/daily_favorites.ts';
import type { Logger } from 'pino';
import { registerChatRoutes } from './routes/chat.ts';
import { registerB3Routes } from './routes/b3.ts';
import { registerNewsRoutes } from './routes/news.ts';
import { registerFavoritesRoutes } from './routes/favorites.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerAnalysisRoutes } from './routes/analysis.ts';
import { registerPredictionsRoutes } from './routes/predictions.ts';

export const VERSION = '0.2.0';

export interface AppDeps {
  db: DB;
  log: Logger;
  b3?: Source;
  newsSvc?: NewsService;
  loop?: QueryLoop;
  dailyJob?: DailyFavoritesJob;
  adminToken?: string;
  model?: string;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'too many requests' }),
  });

  // Request logger hook
  app.addHook('onResponse', (req, reply, done) => {
    deps.log.info({
      method: req.method,
      path: req.routeOptions?.url ?? req.url,
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    }, 'request');
    done();
  });

  // Error handler
  app.setErrorHandler((err, _req, reply) => {
    deps.log.error({ err }, 'unhandled error');
    reply.status(500).send({ error: 'internal server error' });
  });

  // Health
  app.get('/health', async () => ({
    status: 'ok',
    version: VERSION,
    db: 'ok',
  }));

  // API config — never exposes the API key, only non-sensitive values
  app.get('/api/config', async () => ({ version: VERSION, model: deps.model ?? '' }));

  // Domain routes
  await registerB3Routes(app, deps);
  await registerNewsRoutes(app, deps);
  await registerFavoritesRoutes(app, deps);
  await registerChatRoutes(app, deps);
  await registerAdminRoutes(app, deps);
  await registerAnalysisRoutes(app, deps);
  await registerPredictionsRoutes(app, deps);

  return app;
}
