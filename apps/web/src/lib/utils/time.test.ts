import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './time';

function makeDate(offsetMs: number, base: Date): string {
  return new Date(base.getTime() - offsetMs).toISOString();
}

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-17T12:00:00.000Z');

  it('returns "agora mesmo" for less than 60 seconds ago', () => {
    const iso = makeDate(30_000, now); // 30s
    expect(formatRelativeTime(iso, now)).toBe('agora mesmo');
  });

  it('returns "agora mesmo" for 0 seconds', () => {
    expect(formatRelativeTime(now.toISOString(), now)).toBe('agora mesmo');
  });

  it('returns "há 1min" for 61 seconds ago', () => {
    const iso = makeDate(61_000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 1min');
  });

  it('returns "há 3min" for 3 minutes ago', () => {
    const iso = makeDate(3 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 3min');
  });

  it('returns "há 59min" for 59 minutes ago', () => {
    const iso = makeDate(59 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 59min');
  });

  it('returns "há 1h" for 1 hour ago', () => {
    const iso = makeDate(60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 1h');
  });

  it('returns "há 2h" for 2 hours ago', () => {
    const iso = makeDate(2 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 2h');
  });

  it('returns "há 23h" for 23 hours ago', () => {
    const iso = makeDate(23 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 23h');
  });

  it('returns "há 1d" for 1 day ago', () => {
    const iso = makeDate(24 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 1d');
  });

  it('returns "há 5d" for 5 days ago', () => {
    const iso = makeDate(5 * 24 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 5d');
  });

  it('returns "há 6d" for 6 days ago', () => {
    const iso = makeDate(6 * 24 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('há 6d');
  });

  it('returns date "12 abr" for 8 days ago (more than 7d)', () => {
    // now = 2026-04-17, 8 days ago = 2026-04-09
    const iso = makeDate(8 * 24 * 60 * 60 * 1000, now);
    expect(formatRelativeTime(iso, now)).toBe('9 abr');
  });

  it('returns date in Portuguese month abbreviation', () => {
    // January article
    const iso = new Date('2026-01-05T00:00:00.000Z').toISOString();
    const laterNow = new Date('2026-04-17T00:00:00.000Z');
    expect(formatRelativeTime(iso, laterNow)).toBe('5 jan');
  });

  it('returns "12 dez" for December date', () => {
    const iso = new Date('2025-12-12T00:00:00.000Z').toISOString();
    const laterNow = new Date('2026-04-17T00:00:00.000Z');
    expect(formatRelativeTime(iso, laterNow)).toBe('12 dez');
  });

  it('uses current Date when now is not provided', () => {
    // Just check it does not throw
    const iso = new Date(Date.now() - 5000).toISOString();
    expect(() => formatRelativeTime(iso)).not.toThrow();
  });
});
