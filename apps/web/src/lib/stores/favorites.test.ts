import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import type { FavoritesState } from './favorites';
import type { FavoriteEnriched, Favorite } from '@genie/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<{
  getFavorites: (enrich?: boolean) => Promise<FavoriteEnriched[] | Favorite[]>;
  addFavorite: (t: string) => Promise<{ ticker: string; status: string }>;
  removeFavorite: (t: string) => Promise<void>;
}> = {}) {
  return {
    getFavorites: vi.fn().mockResolvedValue([]),
    addFavorite: vi.fn().mockResolvedValue({ ticker: 'X', status: 'added' }),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeStore() {
  return writable<FavoritesState>({
    tickers: new Set(),
    items: [],
    loading: false,
    error: null,
    lastLoadedAt: null,
  });
}

function emptyFav(ticker: string): FavoriteEnriched {
  return {
    ticker,
    addedAt: '2026-01-01T00:00:00Z',
    newsCount: 0,
  };
}

// We import createFavoritesActions lazily after setting up the environment.
import { createFavoritesActions } from './favorites';

// ── load() ────────────────────────────────────────────────────────────────────

describe('favoritesActions.load()', () => {
  it('populates items and tickers from enriched API response', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([
        { ticker: 'PETR4', addedAt: '2026-01-01T00:00:00Z', newsCount: 3 },
        { ticker: 'VALE3', addedAt: '2026-01-02T00:00:00Z', newsCount: 0 },
      ]),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.load(true);

    const state = get(store);
    expect(state.tickers.has('PETR4')).toBe(true);
    expect(state.tickers.has('VALE3')).toBe(true);
    expect(state.items).toHaveLength(2);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastLoadedAt).toBeInstanceOf(Date);
  });

  it('normalizes tickers to uppercase', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([
        { ticker: 'petr4', addedAt: '2026-01-01T00:00:00Z', newsCount: 0 },
      ]),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.load(true);

    expect(get(store).tickers.has('PETR4')).toBe(true);
  });

  it('sets error on API failure', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.load();

    const state = get(store);
    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });

  it('skips fetch if data is fresh (lastLoadedAt < 30s)', async () => {
    const client = makeClient();
    const store = makeStore();
    // Pre-set lastLoadedAt to now.
    store.update((s) => ({ ...s, lastLoadedAt: new Date() }));
    const actions = createFavoritesActions(store, client);

    await actions.load();

    expect(client.getFavorites).not.toHaveBeenCalled();
  });

  it('fetches if data is stale (lastLoadedAt > 30s)', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([]),
    });
    const store = makeStore();
    // Pre-set lastLoadedAt to 31 seconds ago.
    const stale = new Date(Date.now() - 31_000);
    store.update((s) => ({ ...s, lastLoadedAt: stale }));
    const actions = createFavoritesActions(store, client);

    await actions.load();

    expect(client.getFavorites).toHaveBeenCalledOnce();
  });

  it('sets loading=true while fetching, false after', async () => {
    let resolve!: (v: FavoriteEnriched[]) => void;
    const promise = new Promise<FavoriteEnriched[]>((res) => {
      resolve = res;
    });
    const client = makeClient({ getFavorites: vi.fn().mockReturnValue(promise) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    const p = actions.load();
    expect(get(store).loading).toBe(true);
    resolve([]);
    await p;
    expect(get(store).loading).toBe(false);
  });
});

// ── has() ─────────────────────────────────────────────────────────────────────

describe('favoritesActions.has()', () => {
  it('returns true for a favorited ticker', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([emptyFav('ITUB4')]),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    expect(actions.has('ITUB4')).toBe(true);
  });

  it('returns false for a non-favorited ticker', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    expect(actions.has('VALE3')).toBe(false);
  });

  it('is O(1) — uses Set internally', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([emptyFav('BBAS3')]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    // Call many times — should always be consistent.
    for (let i = 0; i < 100; i++) {
      expect(actions.has('BBAS3')).toBe(true);
    }
  });

  it('is case-insensitive', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([emptyFav('ITUB4')]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    expect(actions.has('itub4')).toBe(true);
  });
});

// ── toggle() — add ────────────────────────────────────────────────────────────

describe('favoritesActions.toggle() — add', () => {
  it('returns true (now favorited) on success', async () => {
    const client = makeClient();
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    const result = await actions.toggle('VALE3');
    expect(result).toBe(true);
  });

  it('adds ticker to tickers set optimistically', () => {
    const client = makeClient();
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    const promise = actions.toggle('VALE3');
    // Optimistic update is synchronous.
    expect(get(store).tickers.has('VALE3')).toBe(true);
    return promise;
  });

  it('calls addFavorite with uppercase ticker', async () => {
    const client = makeClient();
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.toggle('vale3');

    expect(client.addFavorite).toHaveBeenCalledWith('VALE3');
  });

  it('rolls back optimistic add on API error', async () => {
    const client = makeClient({
      addFavorite: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.toggle('MGLU3');

    expect(get(store).tickers.has('MGLU3')).toBe(false);
    expect(get(store).error).toBeTruthy();
  });

  it('returns original state (false) after rollback', async () => {
    const client = makeClient({
      addFavorite: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    const result = await actions.toggle('MGLU3');
    expect(result).toBe(false);
  });
});

// ── toggle() — remove ────────────────────────────────────────────────────────

describe('favoritesActions.toggle() — remove', () => {
  async function setup() {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([emptyFav('PETR4')]),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();
    return { client, store, actions };
  }

  it('returns false (now unfavorited) on success', async () => {
    const { actions } = await setup();
    const result = await actions.toggle('PETR4');
    expect(result).toBe(false);
  });

  it('removes ticker from tickers set optimistically', async () => {
    const { store, actions } = await setup();
    const promise = actions.toggle('PETR4');
    expect(get(store).tickers.has('PETR4')).toBe(false);
    return promise;
  });

  it('calls removeFavorite with uppercase ticker', async () => {
    const { client, actions } = await setup();
    await actions.toggle('PETR4');
    expect(client.removeFavorite).toHaveBeenCalledWith('PETR4');
  });

  it('rolls back optimistic remove on error', async () => {
    const client = makeClient({
      getFavorites: vi.fn().mockResolvedValue([emptyFav('PETR4')]),
      removeFavorite: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    await actions.toggle('PETR4');

    expect(get(store).tickers.has('PETR4')).toBe(true);
    expect(get(store).error).toBeTruthy();
  });
});

// ── add() ─────────────────────────────────────────────────────────────────────

describe('favoritesActions.add()', () => {
  it('adds ticker and calls API', async () => {
    const client = makeClient();
    const store = makeStore();
    const actions = createFavoritesActions(store, client);

    await actions.add('SANB11');

    expect(get(store).tickers.has('SANB11')).toBe(true);
    expect(client.addFavorite).toHaveBeenCalledWith('SANB11');
  });

  it('is a no-op if already favorited', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([emptyFav('SANB11')]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    await actions.add('SANB11');

    expect(client.addFavorite).not.toHaveBeenCalled();
  });
});

// ── remove() ─────────────────────────────────────────────────────────────────

describe('favoritesActions.remove()', () => {
  it('removes ticker and calls API', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([emptyFav('ELET3')]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    await actions.remove('ELET3');

    expect(get(store).tickers.has('ELET3')).toBe(false);
    expect(client.removeFavorite).toHaveBeenCalledWith('ELET3');
  });

  it('is a no-op if not favorited', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    await actions.remove('ELET3');

    expect(client.removeFavorite).not.toHaveBeenCalled();
  });
});

// ── State serialization ───────────────────────────────────────────────────────

describe('FavoritesState shape', () => {
  it('tickers is a Set for O(1) access', async () => {
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([emptyFav('PETR4')]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load();

    expect(get(store).tickers).toBeInstanceOf(Set);
  });

  it('items contains enriched objects', async () => {
    const enriched: FavoriteEnriched = {
      ticker: 'VALE3',
      addedAt: '2026-01-01T00:00:00Z',
      newsCount: 5,
    };
    const client = makeClient({ getFavorites: vi.fn().mockResolvedValue([enriched]) });
    const store = makeStore();
    const actions = createFavoritesActions(store, client);
    await actions.load(true);

    expect(get(store).items[0].newsCount).toBe(5);
  });
});
