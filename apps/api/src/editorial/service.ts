import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';
import type { Editorial, EditorialSummary } from './types.ts';
import {
  collectArticleIds,
  fetchArticlesByIds,
  getEditorialById,
  getLatestEditorial,
  listEditorialSummaries,
} from './store.ts';

const DEFAULT_ARCHIVE_LIMIT = 14;
const MAX_ARCHIVE_LIMIT = 30;

export class EditorialService {
  constructor(private readonly db: DB, private readonly log: Logger) {}

  latest(): Editorial | null {
    const editorial = getLatestEditorial(this.db);
    return editorial ? this.enrichWithArticles(editorial) : null;
  }

  byId(id: number): Editorial | null {
    const editorial = getEditorialById(this.db, id);
    return editorial ? this.enrichWithArticles(editorial) : null;
  }

  listSummaries(limit = DEFAULT_ARCHIVE_LIMIT): EditorialSummary[] {
    const safe = Math.min(Math.max(limit, 1), MAX_ARCHIVE_LIMIT);
    return listEditorialSummaries(this.db, safe);
  }

  private enrichWithArticles(editorial: Editorial): Editorial {
    const ids = collectArticleIds(editorial.sections);
    if (ids.length === 0) {
      this.log.debug({ editorialId: editorial.id }, 'editorial: no source articles to enrich');
      return { ...editorial, sourceArticles: [] };
    }
    const sourceArticles = [...fetchArticlesByIds(this.db, ids).values()];
    return { ...editorial, sourceArticles };
  }
}
