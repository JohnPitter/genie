import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';
import type { Editorial, EditorialSummary } from './types.ts';
import {
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
    const ids = new Set<number>();
    for (const sec of editorial.sections) {
      for (const id of sec.sourceArticleIds) ids.add(id);
    }
    if (ids.size === 0) {
      this.log.debug({ editorialId: editorial.id }, 'editorial: no source articles to enrich');
      return { ...editorial, sourceArticles: [] };
    }
    const map = fetchArticlesByIds(this.db, [...ids]);
    const sourceArticles = [...map.values()];
    return { ...editorial, sourceArticles };
  }
}
