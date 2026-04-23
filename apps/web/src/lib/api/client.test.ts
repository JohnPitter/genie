import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from './client';
import type { Article } from '@genie/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    if (typeof response === 'function') return response();
    return response;
  });
}

// ── health() ─────────────────────────────────────────────────────────────────

describe('ApiClient.health()', () => {
  it('returns parsed JSON on success', async () => {
    const mockFetch = makeFetch(makeJsonResponse({ status: 'ok', version: '0.1.0' }));
    const client = new ApiClient({ fetch: mockFetch });

    const result = await client.health();

    expect(result).toEqual({ status: 'ok', version: '0.1.0' });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe('/health');
  });

  it('includes version and optional db field', async () => {
    const body = { status: 'ok', version: '1.2.3', db: 'connected' };
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse(body)) });

    const result = await client.health();

    expect(result.db).toBe('connected');
    expect(result.version).toBe('1.2.3');
  });
});

// ── config() ─────────────────────────────────────────────────────────────────

describe('ApiClient.config()', () => {
  it('returns config shape', async () => {
    const body = { version: '0.1.0', model: 'anthropic/claude-sonnet-4.6' };
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse(body)) });

    const result = await client.config();

    expect(result.model).toBe('anthropic/claude-sonnet-4.6');
    const [url] = (client as unknown as { fetchFn: ReturnType<typeof vi.fn> }).fetchFn.mock.calls[0];
    expect(String(url)).toBe('/api/config');
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('ApiClient error handling', () => {
  it('throws ApiError on non-OK status', async () => {
    const body = { message: 'Not Found' };
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse(body, 404)) });

    await expect(client.health()).rejects.toThrow(ApiError);
  });

  it('ApiError carries status code', async () => {
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse({ message: 'Server Error' }, 500)) });

    let caught: ApiError | undefined;
    try {
      await client.health();
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught!.status).toBe(500);
    expect(caught!.message).toBe('Server Error');
  });

  it('ApiError body contains raw response body', async () => {
    const body = { message: 'Bad request', details: 'missing field' };
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse(body, 400)) });

    let caught: ApiError | undefined;
    try {
      await client.health();
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught!.body).toMatchObject({ details: 'missing field' });
  });

  it('ApiError message is user-friendly when non-JSON error body (backend down)', async () => {
    const client = new ApiClient({
      fetch: makeFetch(new Response('Internal Server Error', { status: 503 })),
    });

    let caught: ApiError | undefined;
    try {
      await client.health();
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught!.status).toBe(503);
    expect(caught!.message).toContain('Backend indisponível');
  });

  it('throws ApiError with status 0 on timeout', async () => {
    // Simulate abort by having fetch throw AbortError
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    const mockFetch = vi.fn().mockRejectedValueOnce(abortErr);
    const client = new ApiClient({ fetch: mockFetch });

    let caught: ApiError | undefined;
    try {
      await client.health();
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught!.status).toBe(0);
    expect(caught!.message).toContain('timed out');
  });
});

// ── baseURL ───────────────────────────────────────────────────────────────────

describe('ApiClient baseURL', () => {
  it('prepends baseURL to request path', async () => {
    const mockFetch = makeFetch(makeJsonResponse({ status: 'ok', version: '0.1.0' }));
    const client = new ApiClient({ baseURL: 'http://localhost:5858', fetch: mockFetch });

    await client.health();

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe('http://localhost:5858/health');
  });
});

// ── getNewsByCategory() ───────────────────────────────────────────────────────

describe('ApiClient.getNewsByCategory()', () => {
  it('builds correct URL with category and default limit', async () => {
    const articles: Article[] = [];
    const mockFetch = makeFetch(makeJsonResponse(articles));
    const client = new ApiClient({ fetch: mockFetch });

    await client.getNewsByCategory('financeiro');

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('category=financeiro');
    expect(String(url)).toContain('limit=20');
  });

  it('uses provided limit', async () => {
    const mockFetch = makeFetch(makeJsonResponse([]));
    const client = new ApiClient({ fetch: mockFetch });

    await client.getNewsByCategory('financeiro', 5);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('limit=5');
  });

  it('returns article array', async () => {
    const articles: Article[] = [
      {
        title: 'Test',
        url: 'https://example.com',
        source: 'test',
        tickers: ['PETR4'],
        fetchedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const client = new ApiClient({ fetch: makeFetch(makeJsonResponse(articles)) });

    const result = await client.getNewsByCategory('financeiro');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test');
  });
});

// ── getNewsByTicker() ─────────────────────────────────────────────────────────

describe('ApiClient.getNewsByTicker()', () => {
  it('builds correct URL with ticker param', async () => {
    const mockFetch = makeFetch(makeJsonResponse([]));
    const client = new ApiClient({ fetch: mockFetch });

    await client.getNewsByTicker('PETR4', 10);

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('ticker=PETR4');
    expect(String(url)).toContain('limit=10');
  });
});

// ── Accept header ─────────────────────────────────────────────────────────────

describe('ApiClient request headers', () => {
  it('sends Accept: application/json', async () => {
    const mockFetch = makeFetch(makeJsonResponse({ status: 'ok', version: '0.1.0' }));
    const client = new ApiClient({ fetch: mockFetch });

    await client.health();

    const [, init] = mockFetch.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
  });
});

// ── non-JSON error body ────────────────────────────────────────────────────────

describe('ApiClient non-JSON error body', () => {
  it('handles non-JSON error body gracefully', async () => {
    const mockFetch = makeFetch(new Response('plain error', { status: 422 }));
    const client = new ApiClient({ fetch: mockFetch });

    let caught: ApiError | undefined;
    try {
      await client.health();
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught!.status).toBe(422);
  });
});

// ── beforeEach reset ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});
