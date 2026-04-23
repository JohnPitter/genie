import * as cheerio from 'cheerio';
import type { Tool } from '../agent/tool.ts';
import type { NewsSearcher, SearchResult } from '../news/service.ts';
import type { Logger } from 'pino';

const DEFAULT_BASE_URL = 'https://html.duckduckgo.com';
const USER_AGENT = 'Mozilla/5.0 (Genie/1.0)';
const TIMEOUT_MS = 15_000;
const MAX_RESULTS = 10;

export class WebSearch implements NewsSearcher {
  constructor(
    private readonly log: Logger,
    private readonly baseURL = DEFAULT_BASE_URL,
  ) {}

  async search(query: string, maxResults = MAX_RESULTS, signal?: AbortSignal): Promise<SearchResult[]> {
    if (!query.trim()) throw new Error('web_search: query must not be empty');

    const url = `${this.baseURL}/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    const t0 = Date.now();
    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
        signal: combined,
      });
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 500) throw new Error(`web_search: HTTP ${resp.status} from DuckDuckGo`);

    const html = await resp.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result').each((_i, el) => {
      if (results.length >= maxResults) return;
      const $el = $(el);
      const title = $el.find('.result__title').text().trim() || $el.find('.result__a').text().trim();

      let rawURL = '';
      const urlElHref = $el.find('.result__url').attr('href');
      const aHref = $el.find('.result__a').attr('href');
      if (urlElHref) rawURL = decodeDDGRedirect(urlElHref);
      else if (aHref) rawURL = decodeDDGRedirect(aHref);
      else rawURL = $el.find('.result__url').text().trim();

      const snippet = $el.find('.result__snippet').text().trim();
      if (!title && !rawURL) return;
      results.push({ title, url: rawURL, snippet });
    });

    this.log.info({ query, results: results.length, durationMs: Date.now() - t0 }, 'search completed');
    return results;
  }

  asTool(): Tool {
    return {
      name: 'web_search',
      description: 'Busca na web via DuckDuckGo e retorna uma lista de resultados com título, URL e trecho relevante.',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'termo de busca' },
          max_results: { type: 'integer', default: 10, minimum: 1, maximum: 20 },
        },
        required: ['query'],
      },
      concurrent: true,
      handler: async (args, signal) => {
        const { query, max_results } = args as { query?: string; max_results?: number };
        if (!query?.trim()) return { error: 'query must not be empty' };
        const limit = Math.max(1, Math.min(20, max_results ?? MAX_RESULTS));
        return this.search(query, limit, signal);
      },
    };
  }
}


function decodeDDGRedirect(raw: string): string {
  if (!raw.includes('/l/?') && !raw.includes('/l?')) return raw;
  try {
    const u = new URL(raw, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    // ignore
  }
  return raw;
}
