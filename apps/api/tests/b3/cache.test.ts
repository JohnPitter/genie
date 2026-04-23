import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from '../../src/b3/cache.ts';

describe('TTLCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns undefined for missing key', () => {
    const cache = new TTLCache<string>();
    expect(cache.get('missing')).toBeUndefined();
    cache.stop();
  });

  it('returns value before TTL expires', () => {
    const cache = new TTLCache<string>();
    cache.set('key', 'value', 5_000);
    expect(cache.get('key')).toBe('value');
    cache.stop();
  });

  it('returns undefined after TTL expires', () => {
    const cache = new TTLCache<string>();
    cache.set('key', 'value', 1_000);
    vi.advanceTimersByTime(1_001);
    expect(cache.get('key')).toBeUndefined();
    cache.stop();
  });

  it('delete removes the key', () => {
    const cache = new TTLCache<string>();
    cache.set('key', 'value', 10_000);
    cache.delete('key');
    expect(cache.get('key')).toBeUndefined();
    cache.stop();
  });

  it('overwrite extends TTL', () => {
    const cache = new TTLCache<number>();
    cache.set('n', 1, 1_000);
    vi.advanceTimersByTime(500);
    cache.set('n', 2, 5_000);
    vi.advanceTimersByTime(1_000);
    expect(cache.get('n')).toBe(2);
    cache.stop();
  });

  it('independent TTLs per key', () => {
    const cache = new TTLCache<string>();
    cache.set('short', 'a', 500);
    cache.set('long', 'b', 10_000);
    vi.advanceTimersByTime(600);
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('b');
    cache.stop();
  });

  it('stop prevents further cleanups without error', () => {
    const cache = new TTLCache<string>(100);
    cache.set('k', 'v', 50);
    cache.stop();
    vi.advanceTimersByTime(200);
    // no throw — stop should be idempotent
    expect(() => cache.stop()).not.toThrow();
  });
});
