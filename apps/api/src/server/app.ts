import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DB } from '../store/db.ts';
import type { Source } from '../b3/source.ts';
import type { NewsService } from '../news/service.ts';
import type { QueryLoop } from '../agent/loop.ts';
import type { DailyFavoritesJob } from '../jobs/daily_favorites.ts';
import type { EditorialRefreshJob } from '../jobs/editorial_refresh.ts';
import type { EditorialService } from '../editorial/service.ts';
import type { Logger } from 'pino';
import { registerChatRoutes } from './routes/chat.ts';
import { registerB3Routes } from './routes/b3.ts';
import { registerNewsRoutes } from './routes/news.ts';
import { registerFavoritesRoutes } from './routes/favorites.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerAnalysisRoutes } from './routes/analysis.ts';
import { registerPredictionsRoutes } from './routes/predictions.ts';
import { registerEditorialRoutes } from './routes/editorials.ts';

export const VERSION = '0.2.0';

/** Extrai o IP real do cliente respeitando proxies confiáveis. */
function clientIp(req: FastifyRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return (first ?? '').trim();
  }
  return req.ip ?? 'unknown';
}

export interface AppDeps {
  db: DB;
  log: Logger;
  b3?: Source;
  newsSvc?: NewsService;
  loop?: QueryLoop;
  dailyJob?: DailyFavoritesJob;
  editorialSvc?: EditorialService;
  editorialJob?: EditorialRefreshJob;
  adminToken?: string;
  model?: string;
  /** Comma-separated extra CORS origins for production */
  allowedOrigins?: string;
  /** Whether to trust proxy headers (X-Forwarded-For) */
  trustProxy?: boolean;
  /** Used to toggle prod-only features (HSTS, error detail suppression) */
  isProd?: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const isProd = deps.isProd ?? false;

  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    trustProxy: deps.trustProxy ?? false,
  });

  // ── Security headers (Helmet) ──────────────────────────────────────────────
  // Desativa contentSecurityPolicy pois a API é JSON-only (sem HTML)
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  const devOrigins = ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174'];
  const prodOrigins = deps.allowedOrigins
    ? deps.allowedOrigins.split(',').map(o => o.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [...devOrigins, ...prodOrigins];

  await app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Admin-Token'],
    credentials: false,
  });

  // ── Rate limiting global ───────────────────────────────────────────────────
  // Chave por IP real — evita que um único cliente consuma todo o pool
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: clientIp,
    errorResponseBuilder: (_req, context) => ({
      error: 'too many requests',
      retryAfter: Math.ceil((context as { ttl: number }).ttl / 1000),
    }),
  });

  // ── Request logger ─────────────────────────────────────────────────────────
  app.addHook('onResponse', (req, reply, done) => {
    deps.log.info({
      method: req.method,
      path: req.routeOptions?.url ?? req.url,
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      ip: clientIp(req),
    }, 'request');
    done();
  });

  // ── Error handler ──────────────────────────────────────────────────────────
  // Em produção não vaza stack traces; em desenvolvimento mantém detalhes
  app.setErrorHandler((err, _req, reply) => {
    deps.log.error({ err }, 'unhandled error');
    if (reply.statusCode === 429) {
      // Já tratado pelo rate-limit plugin — não sobrescrever
      return;
    }
    const detail = err instanceof Error ? err.message : String(err);
    reply.status(500).send({
      error: 'internal server error',
      ...(isProd ? {} : { detail }),
    });
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
  await registerEditorialRoutes(app, deps);

  return app;
}
