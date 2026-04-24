import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';

const ARCHIVE_LIMIT_DEFAULT = 14;
const ARCHIVE_LIMIT_MAX = 30;

export async function registerEditorialRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>('/api/editorials', async (req, reply) => {
    if (!deps.editorialSvc) return reply.status(503).send({ error: 'editorial service not available' });

    let limit = ARCHIVE_LIMIT_DEFAULT;
    if (req.query.limit) {
      const n = parseInt(req.query.limit, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return reply.status(400).send({ error: 'limit must be a positive integer' });
      }
      limit = Math.min(n, ARCHIVE_LIMIT_MAX);
    }
    const list = deps.editorialSvc.listSummaries(limit);
    reply.header('Cache-Control', 'public, max-age=60');
    return list;
  });

  app.get('/api/editorials/latest', async (_req, reply) => {
    if (!deps.editorialSvc) return reply.status(503).send({ error: 'editorial service not available' });
    const editorial = deps.editorialSvc.latest();
    if (!editorial) return reply.status(404).send({ error: 'no editorial available yet' });
    reply.header('Cache-Control', 'public, max-age=60');
    return editorial;
  });

  app.get<{ Params: { id: string } }>('/api/editorials/:id', async (req, reply) => {
    if (!deps.editorialSvc) return reply.status(503).send({ error: 'editorial service not available' });
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'invalid id' });
    }
    const editorial = deps.editorialSvc.byId(id);
    if (!editorial) return reply.status(404).send({ error: 'editorial not found' });
    reply.header('Cache-Control', 'public, max-age=300');
    return editorial;
  });
}
