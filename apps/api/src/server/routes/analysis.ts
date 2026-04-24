import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.ts';
import { fetchHistory } from '../../b3/history.ts';
import { computeIndicators } from '../../b3/indicators.ts';
import { analyseStock } from '../../b3/analyst.ts';
import type { StockAnalysis } from '../../b3/types.ts';
import { validateTicker } from '../../b3/source.ts';
import { TTLCache } from '../../b3/cache.ts';
import { getConfig } from '../../lib/config.ts';

const CACHE_TTL_MS = 30 * 60_000; // 30 min — indicadores não mudam no intra-day

const cache = new TTLCache<StockAnalysis>();

export async function registerAnalysisRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get<{ Params: { ticker: string } }>(
    '/api/b3/analysis/:ticker',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase().trim();

      try {
        validateTicker(ticker);
      } catch {
        return reply.status(400).send({ error: `invalid ticker: ${ticker}` });
      }

      // Cache hit
      const cached = cache.get(ticker);
      if (cached) {
        deps.log.debug({ ticker }, 'analysis cache hit');
        return reply.header('Cache-Control', 'public, max-age=1800').send(cached);
      }

      const config = getConfig();
      const apiKey = config.OPENROUTER_API_KEY;
      const model = config.OPENROUTER_MODEL;
      const modelFallback = config.OPENROUTER_MODEL_FALLBACK;

      try {
        // 1. Fetch historical OHLCV (90 days)
        const histResult = await fetchHistory(ticker, 90, undefined, deps.log);

        // 2. Compute technical indicators
        const indicators = computeIndicators(
          histResult.history,
          histResult.high52w,
          histResult.low52w,
        );

        // 3. Fetch fundamentals (best-effort — don't fail if unavailable)
        let fundamentals = null;
        if (deps.b3) {
          try {
            fundamentals = await deps.b3.fundamentals(ticker);
          } catch {
            deps.log.debug({ ticker }, 'analysis: fundamentals unavailable, proceeding without');
          }
        }

        // 4. Fetch recent news snippets for the ticker
        let newsSnippets: string[] = [];
        if (deps.newsSvc) {
          try {
            const articles = await deps.newsSvc.byTicker(ticker, 4);
            newsSnippets = articles.map(a => a.title);
          } catch {
            /* non-fatal */
          }
        }

        // 5. LLM analysis
        const analysis = await analyseStock(
          ticker,
          histResult.name,
          histResult.currentPrice,
          histResult.changePct,
          indicators,
          fundamentals,
          newsSnippets,
          apiKey,
          model,
          deps.log,
          modelFallback,
        );

        // Limit history to last 60 points for the sparkline chart
        const history = histResult.history.slice(-60);

        const result: StockAnalysis = {
          ticker,
          name: histResult.name,
          price: histResult.currentPrice,
          changePct: histResult.changePct,
          indicators,
          analysis,
          history,
          generatedAt: new Date().toISOString(),
        };

        cache.set(ticker, result, CACHE_TTL_MS);
        return reply.header('Cache-Control', 'public, max-age=1800').send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        deps.log.error({ ticker, err }, 'analysis: failed');

        if (msg.includes('ticker not found') || msg.includes('TICKER_NOT_FOUND')) {
          return reply.status(404).send({ error: `Ativo ${ticker} não encontrado.` });
        }
        return reply.status(500).send({ error: 'Falha ao gerar análise. Tente novamente.' });
      }
    },
  );
}
