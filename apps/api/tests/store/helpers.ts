import { openDB, migrate, type DB } from '../../src/store/db.ts';

export function openTestDB(): DB {
  const db = openDB(':memory:');
  migrate(db);
  return db;
}
