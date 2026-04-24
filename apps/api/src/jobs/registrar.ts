import type { Scheduler } from './scheduler.ts';
import type { DB } from '../store/db.ts';
import type { NewsService } from '../news/service.ts';
import type { Source } from '../b3/source.ts';
import type { Logger } from 'pino';
import { DailyFavoritesJob } from './daily_favorites.ts';
import { NewsRefreshJob } from './news_refresh.ts';
import { PredictionsRefreshJob } from './predictions_refresh.ts';
import { EditorialRefreshJob } from './editorial_refresh.ts';

const DAILY_SPEC = '0 8 * * 1-5';              // 08:00 BRT weekdays
const REFRESH_SPEC = '0 * * * *';               // every hour
const PREDICTIONS_SPEC = '15 10,13 * * 1-5';    // 10:15 e 13:15 BRT (abertura + intraday)
const EDITORIAL_SPEC = '0 8,12,16,20 * * *';    // 4x/dia BRT (manhã, meio-dia, tarde, fechamento)
const BRT_TZ = 'America/Sao_Paulo';

export interface JobDeps {
  db: DB;
  newsSvc: NewsService;
  b3?: Source;
  log: Logger;
  dailySpec?: string;
  refreshSpec?: string;
  predictionsSpec?: string;
  editorialSpec?: string;
}

export function registerJobs(sched: Scheduler, deps: JobDeps): void {
  const daily = new DailyFavoritesJob(deps.db, deps.newsSvc, deps.log);
  sched.schedule(deps.dailySpec ?? DAILY_SPEC, 'daily-favorites-news', s => daily.run(s));

  const refresh = new NewsRefreshJob(deps.db, deps.newsSvc, deps.b3, deps.log);
  sched.schedule(deps.refreshSpec ?? REFRESH_SPEC, 'news-refresh', s => refresh.run(s));

  const predictions = new PredictionsRefreshJob(deps.db, deps.log);
  sched.schedule(deps.predictionsSpec ?? PREDICTIONS_SPEC, 'predictions-refresh', s => predictions.run(s));

  const editorial = new EditorialRefreshJob(deps.db, deps.log);
  sched.schedule(
    deps.editorialSpec ?? EDITORIAL_SPEC,
    'editorial-refresh',
    s => editorial.run(s),
    { timezone: BRT_TZ },
  );
}
