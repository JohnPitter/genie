import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import type { DailyFavoritesJob } from '../../jobs/daily_favorites.ts';
import type { EditorialRefreshJob } from '../../jobs/editorial_refresh.ts';
import type { EditorialSlot } from '../../editorial/types.ts';

export interface AdminDeps extends AppDeps {
  dailyJob?: DailyFavoritesJob;
  editorialJob?: EditorialRefreshJob;
  adminToken?: string;
}

const VALID_SLOTS = new Set(['08', '12', '16', '20']);

export async function registerAdminRoutes(app: FastifyInstance, deps: AdminDeps): Promise<void> {
  // Token guard
  app.addHook('preHandler', async (req, reply) => {
    // Only apply to /api/admin/* routes
    if (!req.url.startsWith('/api/admin/')) return;

    if (!deps.adminToken) {
      return reply.status(401).send({ error: 'admin token not configured' });
    }

    const token = req.headers['x-admin-token'];
    if (token !== deps.adminToken) {
      return reply.status(401).send({ error: 'invalid admin token' });
    }
  });

  // Validation endpoint: if preHandler let it through, token is valid
  app.get('/api/admin/auth', async (_req, reply) => {
    return reply.send({ ok: true });
  });

  app.post('/api/admin/jobs/daily-favorites/run', async (_req, reply) => {
    if (!deps.dailyJob) {
      return reply.status(503).send({ error: 'daily favorites job not available' });
    }

    // Run in background — respond immediately with 202
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5 * 60_000);

    void deps.dailyJob.run(controller.signal).catch(err => {
      deps.log.error({ err }, 'admin: daily-favorites job failed');
    });

    return reply.status(202).send({ status: 'started' });
  });

  app.post<{ Body: { slot?: string } }>('/api/admin/jobs/editorial/run', async (req, reply) => {
    if (!deps.editorialJob) {
      return reply.status(503).send({ error: 'editorial job not available' });
    }
    const slot = (req.body?.slot ?? '').trim();
    if (!slot || !VALID_SLOTS.has(slot)) {
      return reply.status(400).send({ error: 'slot must be 08, 12, 16 or 20' });
    }
    void deps.editorialJob.runForSlot(slot as EditorialSlot).catch(err => {
      deps.log.error({ err, slot }, 'admin: editorial job failed');
    });
    return reply.status(202).send({ status: 'started', slot });
  });
}
