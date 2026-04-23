import type { Article, Quote, Fundamentals, Favorite, FavoriteEnriched } from '@genie/shared';

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
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      const message =
        isObjectWithMessage(errorBody)
          ? String(errorBody.message)
          : `HTTP ${response.status}`;
      throw new ApiError(response.status, message, errorBody);
    }

    // 204 No Content has no body to parse.
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isObjectWithMessage(value: unknown): value is { message: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

// ── Default singleton ─────────────────────────────────────────────────────────

export const apiClient = new ApiClient();
