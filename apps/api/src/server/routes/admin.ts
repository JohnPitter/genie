import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import type { DailyFavoritesJob } from '../../jobs/daily_favorites.ts';

export interface AdminDeps extends AppDeps {
  dailyJob?: DailyFavoritesJob;
  adminToken?: string;
}

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
}
