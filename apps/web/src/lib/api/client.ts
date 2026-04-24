import type {
  Article, Quote, Fundamentals, Favorite, FavoriteEnriched,
  StockAnalysis, PredictionsResponse, PredictionItem,
  Editorial, EditorialSummary,
} from '@genie/shared';

// ── ApiError ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

export interface ApiConfig {
  /** Base URL for API requests. Defaults to '' (same origin). */
  baseURL?: string;
  /** Injectable fetch implementation — defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

// ── Health / Config response shapes ──────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  db?: string;
}

export interface ConfigResponse {
  version: string;
  model: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiClient {
  private readonly baseURL: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg?: ApiConfig) {
    this.baseURL = cfg?.baseURL ?? '';
    this.fetchFn = cfg?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  config(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>('GET', '/api/config');
  }

  getNewsByCategory(category: string, limit = 20): Promise<Article[]> {
    const params = new URLSearchParams({ category, limit: String(limit) });
    return this.request<Article[]>('GET', `/api/news?${params}`);
  }

  getNewsByTicker(ticker: string, limit = 20): Promise<Article[]> {
    const params = new URLSearchParams({ ticker, limit: String(limit) });
    return this.request<Article[]>('GET', `/api/news?${params}`);
  }

  getQuote(ticker: string): Promise<Quote> {
    return this.request<Quote>('GET', `/api/b3/quote/${encodeURIComponent(ticker)}`);
  }

  getFundamentals(ticker: string): Promise<Fundamentals> {
    return this.request<Fundamentals>('GET', `/api/b3/fundamentals/${encodeURIComponent(ticker)}`);
  }

  searchTickers(query: string): Promise<{ ticker: string; category: string }[]> {
    const params = new URLSearchParams({ q: query });
    return this.request<{ ticker: string; category: string }[]>('GET', `/api/b3/search?${params}`);
  }

  getFavorites(enrich?: false): Promise<Favorite[]>;
  getFavorites(enrich: true): Promise<FavoriteEnriched[]>;
  getFavorites(enrich?: boolean): Promise<Favorite[] | FavoriteEnriched[]> {
    const params = enrich ? '?enrich=true' : '';
    return this.request<Favorite[] | FavoriteEnriched[]>('GET', `/api/favorites${params}`);
  }

  addFavorite(ticker: string): Promise<{ ticker: string; status: string }> {
    return this.request<{ ticker: string; status: string }>('POST', '/api/favorites', { ticker });
  }

  removeFavorite(ticker: string): Promise<void> {
    return this.request<void>('DELETE', `/api/favorites/${encodeURIComponent(ticker)}`);
  }

  /**
   * Fetches AI-powered technical analysis for a B3 ticker.
   * Takes 10-30s on first call (LLM + historical data). Cached 30min server-side.
   */
  getStockAnalysis(ticker: string): Promise<StockAnalysis> {
    return this.request<StockAnalysis>('GET', `/api/b3/analysis/${encodeURIComponent(ticker)}`);
  }

  /**
   * Fetches the latest predictions ranking (top buy / top sell / all).
   * Computed by the cron screener (10:15 e 13:15 BRT em dias úteis).
   */
  getPredictions(): Promise<PredictionsResponse> {
    return this.request<PredictionsResponse>('GET', '/api/b3/predictions');
  }

  /**
   * Fetches a single-ticker prediction. If no fresh cache, triggers an
   * on-demand analysis (blocks up to ~10s while historical data is fetched).
   */
  getPrediction(ticker: string): Promise<PredictionItem> {
    return this.request<PredictionItem>('GET', `/api/b3/predictions/${encodeURIComponent(ticker)}`);
  }

  /**
   * Busca quotes de múltiplos tickers em paralelo (max 20).
   * Retorna apenas os tickers que responderam — falhas individuais são ignoradas.
   */
  batchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
    return this.request<Record<string, Quote>>('POST', '/api/b3/quotes/batch', { tickers });
  }

  /** Última edição do editorial financeiro (gerado 4x/dia BRT). */
  getLatestEditorial(): Promise<Editorial> {
    return this.request<Editorial>('GET', '/api/editorials/latest');
  }

  /** Edição arquivada por id. */
  getEditorial(id: number): Promise<Editorial> {
    return this.request<Editorial>('GET', `/api/editorials/${id}`);
  }

  /** Lista resumida de edições anteriores (default 14, máx 30). */
  listEditorials(limit = 14): Promise<EditorialSummary[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.request<EditorialSummary[]>('GET', `/api/editorials?${params}`);
  }

  /** Validates the admin token. Returns true if the token grants access, false otherwise. */
  async verifyAdminToken(adminToken: string): Promise<boolean> {
    try {
      await this.requestWithHeaders<{ ok: boolean }>(
        'GET',
        '/api/admin/auth',
        undefined,
        { 'X-Admin-Token': adminToken },
      );
      return true;
    } catch {
      return false;
    }
  }

  triggerDailyRefresh(adminToken?: string): Promise<{ status: string }> {
    const headers: Record<string, string> = {};
    if (adminToken) headers['X-Admin-Token'] = adminToken;
    return this.requestWithHeaders<{ status: string }>(
      'POST',
      '/api/admin/jobs/daily-favorites/run',
      undefined,
      headers,
    );
  }

  /** Dispara o screener de predições em todos os tickers do catálogo (10-15 min). */
  triggerPredictionsRefresh(adminToken: string): Promise<{ status: string; tickers: number }> {
    return this.requestWithHeaders<{ status: string; tickers: number }>(
      'POST',
      '/api/b3/predictions/run',
      undefined,
      { 'X-Admin-Token': adminToken },
    );
  }

  /** Dispara geração manual de uma edição do editorial para o slot especificado. */
  triggerEditorialRefresh(adminToken: string, slot: '08' | '12' | '16' | '20'): Promise<{ status: string; slot: string }> {
    return this.requestWithHeaders<{ status: string; slot: string }>(
      'POST',
      '/api/admin/jobs/editorial/run',
      { slot },
      { 'X-Admin-Token': adminToken },
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private requestWithHeaders<T>(
    method: string,
    path: string,
    body: unknown,
    extraHeaders: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(method, path, body, extraHeaders);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(0, `Request timed out after ${REQUEST_TIMEOUT_MS}ms`, null);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errContentType = response.headers.get('content-type') ?? '';
      let errorBody: unknown;
      let message = `HTTP ${response.status}`;

      if (errContentType.includes('json')) {
        try {
          errorBody = await response.json();
          if (isObjectWithMessage(errorBody)) message = String(errorBody.message);
          else if (isObjectWithError(errorBody)) message = String(errorBody.error);
        } catch {
          /* fall through */
        }
      } else {
        // Non-JSON error (HTML from Vite proxy, plain text, etc.)
        errorBody = await response.text().catch(() => null);
        message = response.status >= 500 || response.status === 0
          ? 'Backend indisponível. Tente novamente em instantes.'
          : `Erro ${response.status} do servidor.`;
      }

      throw new ApiError(response.status, message, errorBody);
    }

    // 204 No Content has no body to parse.
    if (response.status === 204) {
      return undefined as T;
    }

    // Validate Content-Type before parsing — the Vite dev proxy may return HTML
    // (a 404 page) when the backend is restarting, which would crash JSON.parse.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new ApiError(
        response.status,
        'O servidor respondeu algo inesperado. O backend pode estar reiniciando — tente novamente em alguns segundos.',
        null,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        response.status,
        'Resposta inválida do servidor. Tente novamente.',
        null,
      );
    }
  }
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isObjectWithMessage(value: unknown): value is { message: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

function isObjectWithError(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

// ── Default singleton ─────────────────────────────────────────────────────────

export const apiClient = new ApiClient();
