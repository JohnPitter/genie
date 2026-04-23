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
import { Scheduler } from './jobs/scheduler.ts';
import { registerJobs } from './jobs/registrar.ts';
import { DailyFavoritesJob } from './jobs/daily_favorites.ts';
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
const loop = new QueryLoop(llm, registry, config.OPENROUTER_MODEL, log);
log.info({ model: config.OPENROUTER_MODEL }, 'agent query loop initialised');

// News service
const newsSvc = new NewsService(db, webSearch, log);

// Job scheduler + manually-runnable daily job
const sched = new Scheduler(log);
registerJobs(sched, { db, newsSvc, b3: cascade, log });
const dailyJob = new DailyFavoritesJob(db, newsSvc, log);

// HTTP server
const app = await buildApp({
  db,
  log,
  b3: cascade,
  newsSvc,
  loop,
  dailyJob,
  model: config.OPENROUTER_MODEL,
  ...(config.ADMIN_TOKEN ? { adminToken: config.ADMIN_TOKEN } : {}),
});
await app.listen({ port: config.PORT, host: '0.0.0.0' });
log.info({ port: config.PORT }, 'server listening');

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
