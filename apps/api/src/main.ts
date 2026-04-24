import 'dotenv/config';
import { getConfig } from './lib/config.ts';
import { getLogger } from './lib/logger.ts';
import { openAndMigrate } from './store/db.ts';
import { BrapiSource } from './b3/brapi.ts';
import { YFinanceSource } from './b3/yfinance.ts';
import { StatusInvestScraper } from './b3/statusinvest.ts';
import { GoogleFinanceSource } from './b3/googlefinance.ts';
import { FundamentusSource } from './b3/fundamentus.ts';
import { Cascade } from './b3/cascade.ts';
import { TTLCache } from './b3/cache.ts';
import { WebSearch } from './tools/web_search.ts';
import { WebFetch } from './tools/web_fetch.ts';
import { b3QuoteTool } from './tools/b3_quote.ts';
import { b3FundamentalsTool } from './tools/b3_fundamentals.ts';
import { b3SearchTickerTool } from './tools/b3_search_ticker.ts';
import { favoritesTools } from './tools/favorites.ts';
import { Registry } from './agent/tool.ts';
import { OpenRouterClient } from './agent/openrouter.ts';
import { QueryLoop } from './agent/loop.ts';
import { NewsService } from './news/service.ts';
import { GoogleNewsSearcher } from './news/google_news.ts';
import { Scheduler } from './jobs/scheduler.ts';
import { registerJobs } from './jobs/registrar.ts';
import { DailyFavoritesJob } from './jobs/daily_favorites.ts';
import { NewsRefreshJob } from './jobs/news_refresh.ts';
import { PredictionsRefreshJob } from './jobs/predictions_refresh.ts';
import { EditorialRefreshJob, lastPassedSlot } from './jobs/editorial_refresh.ts';
import { EditorialService } from './editorial/service.ts';
import { buildApp } from './server/app.ts';

const config = getConfig();
const log = getLogger();

log.info({ port: config.PORT, db: config.DB_PATH }, 'genie api (ts) starting');

// Database
const db = openAndMigrate(config.DB_PATH);
log.info({ db: config.DB_PATH }, 'database ready');

// B3 cascade
const b3Cache = new TTLCache();
const cascade = new Cascade(
  [
    new BrapiSource('', log),        // 1. brapi.dev API (melhor qualidade)
    new YFinanceSource(log),          // 2. Yahoo Finance (boa cobertura)
    new StatusInvestScraper(log),     // 3. StatusInvest scraper (B3 nativa)
    new GoogleFinanceSource(log),     // 4. Google Finance scraper (ampla cobertura)
    new FundamentusSource(log),       // 5. Fundamentus (cobre small/mid caps que outros perdem)
  ],
  log,
);
void b3Cache; // cache is internal to Cascade

// Agent registry
const registry = new Registry();
const webSearch = new WebSearch(log);
const webFetch = new WebFetch(log);

for (const tool of [
  b3QuoteTool(cascade, log),
  b3FundamentalsTool(cascade, log),
  b3SearchTickerTool(),
  ...favoritesTools(db, log),
  webSearch.asTool(),
  webFetch.asTool(),
]) {
  registry.register(tool);
}
log.info({ tools: registry.list().length }, 'agent tools registered');

// LLM + query loop
const llm = new OpenRouterClient(config.OPENROUTER_API_KEY, log, {
  baseURL: 'https://openrouter.ai/api/v1',
});
const loop = new QueryLoop(llm, registry, config.OPENROUTER_MODEL, log, {
  ...(config.OPENROUTER_MODEL_FALLBACK ? { fallbackModels: config.OPENROUTER_MODEL_FALLBACK } : {}),
});
log.info(
  { model: config.OPENROUTER_MODEL, fallbacks: config.OPENROUTER_MODEL_FALLBACK ?? 'none' },
  'agent query loop initialised',
);

// News service — uses Google News RSS (reliable, no CAPTCHA blocks)
const googleNews = new GoogleNewsSearcher(log);
const newsSvc = new NewsService(db, googleNews, log);

// Editorial service (read-only access to news_editorials)
const editorialSvc = new EditorialService(db, log);

// Job scheduler + manually-runnable jobs
const sched = new Scheduler(log);
registerJobs(sched, { db, newsSvc, b3: cascade, log });
const dailyJob = new DailyFavoritesJob(db, newsSvc, log);
const editorialJob = new EditorialRefreshJob(db, log);

// HTTP server
const app = await buildApp({
  db,
  log,
  b3: cascade,
  newsSvc,
  loop,
  dailyJob,
  editorialSvc,
  editorialJob,
  model: config.OPENROUTER_MODEL,
  ...(config.ADMIN_TOKEN ? { adminToken: config.ADMIN_TOKEN } : {}),
});
await app.listen({ port: config.PORT, host: '0.0.0.0' });
log.info({ port: config.PORT }, 'server listening');

// ── Bootstrap: dispara jobs em background quando tabelas críticas estão vazias
//    (primeiro deploy ou DB novo) para que /predicoes, / e /editorial sempre
//    tenham conteúdo no primeiro acesso, sem esperar o próximo cron.
//    Delay de 5s para não atrasar o startup + dar tempo de os logs
//    aparecerem no dashboard.
async function bootstrapIfEmpty(): Promise<void> {
  // Predictions
  try {
    const row = db.prepare<[], { count: number }>('SELECT COUNT(*) as count FROM predictions').get();
    if (!row || row.count === 0) {
      log.info('bootstrap: predictions table is empty, scheduling screener in 5s');
      setTimeout(() => {
        const job = new PredictionsRefreshJob(db, log);
        job.run().catch(err => log.error({ err }, 'bootstrap: predictions refresh failed'));
      }, 5000);
    } else {
      log.debug({ count: row.count }, 'bootstrap: predictions table already populated, skipping');
    }
  } catch (err) {
    log.warn({ err }, 'bootstrap: predictions check failed (non-fatal)');
  }

  // News + Editorial — encadeados: editorial precisa de notícias no DB para ter
  // o que analisar. Se ambos vazios, news roda primeiro e o editorial aguarda.
  let newsEmpty = false;
  let editorialEmpty = false;
  try {
    const n = db.prepare<[], { count: number }>('SELECT COUNT(*) as count FROM news_articles').get();
    newsEmpty = !n || n.count === 0;
    const e = db.prepare<[], { count: number }>('SELECT COUNT(*) as count FROM news_editorials').get();
    editorialEmpty = !e || e.count === 0;
  } catch (err) {
    log.warn({ err }, 'bootstrap: news/editorial check failed (non-fatal)');
    return;
  }

  if (!newsEmpty && !editorialEmpty) {
    log.debug('bootstrap: news + editorial already populated, skipping');
    return;
  }

  setTimeout(() => {
    void runNewsAndEditorialBootstrap(newsEmpty, editorialEmpty);
  }, 5000);
}

async function runNewsAndEditorialBootstrap(newsEmpty: boolean, editorialEmpty: boolean): Promise<void> {
  if (newsEmpty) {
    log.info('bootstrap: news_articles is empty, running news-refresh job');
    try {
      const newsJob = new NewsRefreshJob(db, newsSvc, cascade, log);
      await newsJob.run();
      log.info('bootstrap: news-refresh complete');
    } catch (err) {
      log.error({ err }, 'bootstrap: news-refresh failed');
      // segue para tentar editorial mesmo assim — pode haver dados parciais
    }
  }

  if (editorialEmpty) {
    const slot = lastPassedSlot();
    log.info({ slot }, 'bootstrap: news_editorials is empty, generating editorial for last passed slot');
    try {
      await editorialJob.runForSlot(slot);
      log.info({ slot }, 'bootstrap: editorial generation complete');
    } catch (err) {
      log.error({ err, slot }, 'bootstrap: editorial generation failed');
    }
  }
}

void bootstrapIfEmpty();

// Graceful shutdown
function shutdown(): void {
  log.info('shutting down');
  sched.stop();
  newsSvc.stop();
  cascade.stop();
  app.close().then(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
