import { describe, it, expect, beforeEach } from 'vitest';
import { favoritesTools } from '../../src/tools/favorites.ts';
import { openTestDB } from '../store/helpers.ts';
import type { DB } from '../../src/store/db.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });
let db: DB;

beforeEach(() => { db = openTestDB(); });

describe('favoritesTools', () => {
  it('favorite_add adds ticker and returns status', async () => {
    const [add] = favoritesTools(db, nop);
    const result = await add!.handler({ ticker: 'PETR4' });
    expect(result).toMatchObject({ status: 'added', ticker: 'PETR4' });
  });

  it('favorite_add returns error for invalid ticker format', async () => {
    const [add] = favoritesTools(db, nop);
    const result = await add!.handler({ ticker: 'invalid' });
    expect(result).toMatchObject({ error: 'invalid ticker format' });
  });

  it('favorite_list returns all added favorites', async () => {
    const [add, , list] = favoritesTools(db, nop);
    await add!.handler({ ticker: 'PETR4' });
    await add!.handler({ ticker: 'VALE3' });
    const result = await list!.handler({}) as Array<{ ticker: string }>;
    expect(result.map(r => r.ticker)).toContain('PETR4');
    expect(result.map(r => r.ticker)).toContain('VALE3');
  });

  it('favorite_remove removes ticker', async () => {
    const [add, remove, list] = favoritesTools(db, nop);
    await add!.handler({ ticker: 'ITUB4' });
    await remove!.handler({ ticker: 'ITUB4' });
    const result = await list!.handler({}) as Array<{ ticker: string }>;
    expect(result.map(r => r.ticker)).not.toContain('ITUB4');
  });

  it('add is not concurrent', () => {
    const [add] = favoritesTools(db, nop);
    expect(add!.concurrent).toBe(false);
  });

  it('list is concurrent', () => {
    const [, , list] = favoritesTools(db, nop);
    expect(list!.concurrent).toBe(true);
  });
});
