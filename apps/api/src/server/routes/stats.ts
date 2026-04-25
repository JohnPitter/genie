import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { getGoldenSignals } from '../../lib/metrics.ts';

export async function registerStatsRoutes(app: FastifyInstance, _deps: AppDeps): Promise<void> {
  app.get('/api/admin/stats', async (_req, reply) => {
    return reply.send(getGoldenSignals());
  });
}
