import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDB } from './helpers.ts';
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  isFavorite,
  updateLastNewsAt,
} from '../../src/store/favorites.ts';
import type { DB } from '../../src/store/db.ts';

let db: DB;

beforeEach(() => {
  db = openTestDB();
});

describe('addFavorite + listFavorites', () => {
  it('adds tickers and returns them all', () => {
    addFavorite(db, 'PETR4');
    addFavorite(db, 'VALE3');

    const list = listFavorites(db);
    expect(list).toHaveLength(2);
    const tickers = list.map(f => f.ticker);
    expect(tickers).toContain('PETR4');
    expect(tickers).toContain('VALE3');
  });

  it('is idempotent — duplicate add does not create duplicate', () => {
    addFavorite(db, 'ITUB4');
    addFavorite(db, 'ITUB4');

    const list = listFavorites(db);
    expect(list).toHaveLength(1);
  });

  it('populates addedAt on insert', () => {
    addFavorite(db, 'MGLU3');
    const [fav] = listFavorites(db);
    expect(fav?.addedAt).toBeTruthy();
  });

  it('returns empty array when no favorites', () => {
    expect(listFavorites(db)).toHaveLength(0);
  });
});

describe('removeFavorite', () => {
  it('removes an existing ticker', () => {
    addFavorite(db, 'BBAS3');
    removeFavorite(db, 'BBAS3');
    expect(listFavorites(db)).toHaveLength(0);
  });

  it('does not error when removing non-existent ticker', () => {
    expect(() => removeFavorite(db, 'NONEXISTENT')).not.toThrow();
  });
});

describe('isFavorite', () => {
  it('returns false before adding', () => {
    expect(isFavorite(db, 'ELET3')).toBe(false);
  });

  it('returns true after adding', () => {
    addFavorite(db, 'ELET3');
    expect(isFavorite(db, 'ELET3')).toBe(true);
  });

  it('returns false after removing', () => {
    addFavorite(db, 'ELET3');
    removeFavorite(db, 'ELET3');
    expect(isFavorite(db, 'ELET3')).toBe(false);
  });
});

describe('updateLastNewsAt', () => {
  it('sets last_news_at for an existing ticker', () => {
    addFavorite(db, 'PETR4');
    const ts = new Date().toISOString();
    updateLastNewsAt(db, 'PETR4', ts);

    const [fav] = listFavorites(db);
    expect(fav?.lastNewsAt).not.toBeNull();
  });

  it('does not error for non-existent ticker', () => {
    expect(() => updateLastNewsAt(db, 'NONEXISTENT', new Date().toISOString())).not.toThrow();
  });

  it('starts as null before being set', () => {
    addFavorite(db, 'VALE3');
    const [fav] = listFavorites(db);
    expect(fav?.lastNewsAt).toBeNull();
  });
});
