import { writable, derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import type { FavoriteEnriched, Favorite } from '@genie/shared';
import { ApiClient, apiClient as defaultApiClient } from '$lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FavoritesState {
  /** Uppercase ticker symbols that are favorited (for O(1) lookup). */
  tickers: Set<string>;
  /** Full enriched items (populated after load(enrich=true)). */
  items: FavoriteEnriched[];
  loading: boolean;
  error: string | null;
  lastLoadedAt: Date | null;
}

// ── Stale TTL ─────────────────────────────────────────────────────────────────

const STALE_TTL_MS = 30_000; // 30 seconds

// ── Internal writable ─────────────────────────────────────────────────────────

const _store = writable<FavoritesState>({
  tickers: new Set(),
  items: [],
  loading: false,
  error: null,
  lastLoadedAt: null,
});

/** Public readable view of favorites state. */
export const favoritesStore: Readable<FavoritesState> = _store;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStale(lastLoadedAt: Date | null): boolean {
  if (!lastLoadedAt) return true;
  return Date.now() - lastLoadedAt.getTime() > STALE_TTL_MS;
}

// ── Actions factory ───────────────────────────────────────────────────────────

export interface FavoritesActions {
  /** Load favorites from the API. enrich=true fetches live quotes + news. */
  load(enrich?: boolean): Promise<void>;
  /**
   * Toggle a ticker. Returns true if the ticker is now favorited.
   * Performs an optimistic update and reverts on error.
   */
  toggle(ticker: string): Promise<boolean>;
  /** Add a ticker to favorites. */
  add(ticker: string): Promise<void>;
  /** Remove a ticker from favorites. */
  remove(ticker: string): Promise<void>;
  /** O(1) synchronous check if ticker is currently favorited. */
  has(ticker: string): boolean;
}

/**
 * Creates favorites actions bound to a given store and API client.
 * Pass a custom client in tests to avoid real network calls.
 */
export function createFavoritesActions(
  store = _store,
  client: ApiClient = defaultApiClient,
): FavoritesActions {
  // Capture current tickers set from the store for O(1) has() calls.
  // We keep a local reference that stays in sync via store.update().
  let _tickers = new Set<string>();
  store.subscribe((s) => {
    _tickers = s.tickers;
  });

  let _lastLoadedAt: Date | null = null;
  store.subscribe((s) => {
    _lastLoadedAt = s.lastLoadedAt;
  });

  return {
    async load(enrich = true): Promise<void> {
      if (!isStale(_lastLoadedAt)) return;

      store.update((s) => ({ ...s, loading: true, error: null }));
      try {
        if (enrich) {
          const items = await client.getFavorites(true);
          const tickers = new Set(items.map((f) => f.ticker.toUpperCase()));
          store.set({ tickers, items, loading: false, error: null, lastLoadedAt: new Date() });
        } else {
          const favs = await client.getFavorites();
          const tickers = new Set((favs as Favorite[]).map((f) => f.ticker.toUpperCase()));
          store.update((s) => ({
            ...s,
            tickers,
            loading: false,
            error: null,
            lastLoadedAt: new Date(),
          }));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load favorites';
        store.update((s) => ({ ...s, loading: false, error: message }));
      }
    },

    async toggle(ticker: string): Promise<boolean> {
      const upper = ticker.toUpperCase();
      const wasFavorite = _tickers.has(upper);

      // Optimistic update.
      store.update((s) => {
        const next = new Set(s.tickers);
        if (wasFavorite) {
          next.delete(upper);
        } else {
          next.add(upper);
        }
        const items = wasFavorite ? s.items.filter((i) => i.ticker !== upper) : s.items;
        return { ...s, tickers: next, items };
      });

      try {
        if (wasFavorite) {
          await client.removeFavorite(upper);
        } else {
          await client.addFavorite(upper);
        }
        return !wasFavorite;
      } catch (err: unknown) {
        // Rollback optimistic update.
        store.update((s) => {
          const next = new Set(s.tickers);
          if (wasFavorite) {
            next.add(upper);
          } else {
            next.delete(upper);
          }
          const error = err instanceof Error ? err.message : 'Failed to update favorite';
          return { ...s, tickers: next, error };
        });
        return wasFavorite; // state unchanged after rollback
      }
    },

    async add(ticker: string): Promise<void> {
      const upper = ticker.toUpperCase();
      if (_tickers.has(upper)) return;

      // Optimistic.
      store.update((s) => {
        const next = new Set(s.tickers);
        next.add(upper);
        return { ...s, tickers: next };
      });

      try {
        await client.addFavorite(upper);
      } catch (err: unknown) {
        // Rollback.
        store.update((s) => {
          const next = new Set(s.tickers);
          next.delete(upper);
          const error = err instanceof Error ? err.message : 'Failed to add favorite';
          return { ...s, tickers: next, error };
        });
      }
    },

    async remove(ticker: string): Promise<void> {
      const upper = ticker.toUpperCase();
      if (!_tickers.has(upper)) return;

      // Optimistic.
      store.update((s) => {
        const next = new Set(s.tickers);
        next.delete(upper);
        const items = s.items.filter((i) => i.ticker !== upper);
        return { ...s, tickers: next, items };
      });

      try {
        await client.removeFavorite(upper);
      } catch (err: unknown) {
        // Rollback — reload to restore consistent state.
        const error = err instanceof Error ? err.message : 'Failed to remove favorite';
        store.update((s) => ({ ...s, error }));
      }
    },

    has(ticker: string): boolean {
      return _tickers.has(ticker.toUpperCase());
    },
  };
}

// ── Default exported actions ──────────────────────────────────────────────────

export const favoritesActions = createFavoritesActions();

// ── Convenience derived store ─────────────────────────────────────────────────

/** Derived store: count of favorited tickers. */
export const favoritesCount: Readable<number> = derived(
  favoritesStore,
  ($s) => $s.tickers.size,
);
