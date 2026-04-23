import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = ['001_init.sql', '002_news_articles.sql', '003_predictions.sql'] as const;

export type DB = Database.Database;

export function openDB(dbPath: string): DB {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}

export function migrate(db: DB): void {
  const migrationsDir = join(__dirname, 'migrations');
  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }
}

export function openAndMigrate(dbPath: string): DB {
  const db = openDB(dbPath);
  migrate(db);
  return db;
}
