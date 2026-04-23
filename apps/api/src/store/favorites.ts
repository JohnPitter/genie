import type { DB } from './db.ts';

export interface Favorite {
  ticker: string;
  addedAt: string;
  lastNewsAt: string | null;
}

export function addFavorite(db: DB, ticker: string): void {
  db.prepare('INSERT OR IGNORE INTO favorites (ticker) VALUES (?)').run(ticker);
}

export function removeFavorite(db: DB, ticker: string): void {
  db.prepare('DELETE FROM favorites WHERE ticker = ?').run(ticker);
}

export function listFavorites(db: DB): Favorite[] {
  return db
    .prepare<[], Favorite>(
      `SELECT ticker, added_at as addedAt, last_news_at as lastNewsAt
       FROM favorites
       ORDER BY added_at DESC`,
    )
    .all();
}

export function isFavorite(db: DB, ticker: string): boolean {
  const row = db
    .prepare<string, { count: number }>('SELECT COUNT(1) as count FROM favorites WHERE ticker = ?')
    .get(ticker);
  return (row?.count ?? 0) > 0;
}

export function updateLastNewsAt(db: DB, ticker: string, isoTimestamp: string): void {
  db.prepare('UPDATE favorites SET last_news_at = ? WHERE ticker = ?').run(isoTimestamp, ticker);
}
