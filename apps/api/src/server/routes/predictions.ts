import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { latestPredictions, latestPredictionForTicker } from '../../store/predictions.ts';
import { runScreener } from '../../b3/screener.ts';
import { validateTicker } from '../../b3/source.ts';

export async function registerPredictionsRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  /**
   * GET /api/b3/predictions
   * Retorna as predições mais recentes — top compras, top vendas e ranking geral.
   * Dados vêm do screener executado via cron (10:15 e 13:15 BRT).
   */
  app.get('/api/b3/predictions', async (_req, reply) => {
    const items = latestPredictions(deps.db, 100);
    if (items.length === 0) {
      return reply.send({
        topBuy: [],
        topSell: [],
        all: [],
        lastRunAt: null,
        totalAnalysed: 0,
        message: 'As predições ainda estão sendo preparadas. Volte em alguns minutos.',
      });
    }

    // Ordenar separadamente por sinal + score absoluto
    const buys = items
      .filter(p => p.signal === 'compra_forte' || p.signal === 'compra')
      .sort((a, b) => b.score - a.score);
    const sells = items
      .filter(p => p.signal === 'venda_forte' || p.signal === 'venda')
      .sort((a, b) => a.score - b.score);

    // Ranking geral: ordena por força do sinal (|score|) e accuracy de backtest
    const all = [...items].sort((a, b) => {
      const absDiff = Math.abs(b.score) - Math.abs(a.score);
      if (absDiff !== 0) return absDiff;
      return (b.backtestAccuracy ?? 0) - (a.backtestAccuracy ?? 0);
    });

    const lastRunAt = items[0]?.computedAt ?? null;

    return reply
      .header('Cache-Control', 'public, max-age=300')
      .send({
        topBuy: buys.slice(0, 5),
        topSell: sells.slice(0, 5),
        all,
        lastRunAt,
        totalAnalysed: items.length,
      });
  });

  /**
   * GET /api/b3/predictions/:ticker
   * Retorna a última predição para um ticker específico. Se não houver
   * cache, dispara um screener only-for-this-ticker sincronamente.
   */
  app.get<{ Params: { ticker: string } }>(
    '/api/b3/predictions/:ticker',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase().trim();

      try {
        validateTicker(ticker);
      } catch {
        return reply.status(400).send({ error: `ticker inválido: ${ticker}` });
      }

      // 1. Cache hit (predição fresca < 6h)
      const cached = latestPredictionForTicker(deps.db, ticker);
      if (cached) {
        const ageMs = Date.now() - new Date(cached.computedAt).getTime();
        if (ageMs < 6 * 3600_000) {
          return reply.send(cached);
        }
      }

      // 2. Cache miss ou stale → rodar screener para esse ticker
      try {
        await runScreener([ticker], deps.db, deps.log);
        const fresh = latestPredictionForTicker(deps.db, ticker);
        if (!fresh) {
          return reply.status(404).send({ error: `sem dados suficientes para ${ticker}` });
        }
        return reply.send(fresh);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        deps.log.error({ ticker, err }, 'predictions: on-demand screening failed');
        return reply.status(500).send({ error: `falha ao analisar ${ticker}: ${msg}` });
      }
    },
  );

  /**
   * POST /api/b3/predictions/run (admin only)
   * Dispara o screener manualmente. Útil para testes e para inicializar o
   * cache logo após o deploy.
   */
  app.post('/api/b3/predictions/run', async (req, reply) => {
    const token = req.headers['x-admin-token'];
    if (!deps.adminToken || token !== deps.adminToken) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    // Importa aqui para evitar dependência circular no top-level
    const { allTickers } = await import('../../b3/categories.ts');
    const tickers = allTickers().slice(0, 60);

    reply.status(202).send({ status: 'started', tickers: tickers.length });

    // Async (não bloqueia resposta)
    runScreener(tickers, deps.db, deps.log).catch(err =>
      deps.log.error({ err }, 'predictions: manual run failed'),
    );
  });
}
