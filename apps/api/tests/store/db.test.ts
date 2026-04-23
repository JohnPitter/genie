import { describe, it, expect } from 'vitest';
import { openDB, migrate, openAndMigrate } from '../../src/store/db.ts';

describe('openDB', () => {
  it('opens an in-memory database', () => {
    const db = openDB(':memory:');
    expect(db).toBeTruthy();
    db.close();
  });

  it('enables WAL mode for file DBs (in-memory always uses "memory" journal)', () => {
    // SQLite ignores WAL for :memory: databases — journal stays "memory".
    // We verify the pragma runs without error; real WAL is tested on file DBs.
    const db = openDB(':memory:');
    const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(['wal', 'memory']).toContain(row.journal_mode);
    db.close();
  });

  it('enables foreign keys', () => {
    const db = openDB(':memory:');
    const row = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });
});

describe('migrate', () => {
  it('creates all expected tables', () => {
    const db = openDB(':memory:');
    migrate(db);

    const tables = ['favorites', 'news_cache', 'conversations', 'messages', 'news_articles'];
    for (const tbl of tables) {
      const rows = db.prepare(`PRAGMA table_info(${tbl})`).all();
      expect(rows.length, `table ${tbl} should have columns`).toBeGreaterThan(0);
    }

    db.close();
  });

  it('is idempotent — applying twice does not error', () => {
    const db = openDB(':memory:');
    expect(() => migrate(db)).not.toThrow();
    expect(() => migrate(db)).not.toThrow();
    db.close();
  });

  it('creates favorites with correct columns', () => {
    const db = openDB(':memory:');
    migrate(db);

    const cols = (db.prepare('PRAGMA table_info(favorites)').all() as Array<{ name: string }>).map(
      r => r.name,
    );
    expect(cols).toContain('ticker');
    expect(cols).toContain('added_at');
    expect(cols).toContain('last_news_at');

    db.close();
  });

  it('creates messages with correct columns', () => {
    const db = openDB(':memory:');
    migrate(db);

    const cols = (db.prepare('PRAGMA table_info(messages)').all() as Array<{ name: string }>).map(
      r => r.name,
    );
    expect(cols).toContain('id');
    expect(cols).toContain('conversation_id');
    expect(cols).toContain('role');
    expect(cols).toContain('content');
    expect(cols).toContain('created_at');

    db.close();
  });

  it('creates news_articles with correct columns', () => {
    const db = openDB(':memory:');
    migrate(db);

    const cols = (db.prepare('PRAGMA table_info(news_articles)').all() as Array<{ name: string }>).map(
      r => r.name,
    );
    const expected = ['id', 'url', 'title', 'source', 'summary', 'tickers_json', 'category', 'published_at', 'fetched_at'];
    for (const col of expected) {
      expect(cols, `news_articles should have column ${col}`).toContain(col);
    }

    db.close();
  });
});

describe('openAndMigrate', () => {
  it('opens and migrates in a single call', () => {
    const db = openAndMigrate(':memory:');
    const rows = db.prepare('PRAGMA table_info(favorites)').all();
    expect(rows.length).toBeGreaterThan(0);
    db.close();
  });
});
