import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../src/b3/breaker.ts';
import type { Clock } from '../../src/b3/breaker.ts';

function makeMockClock(startMs = 0): { clock: Clock; advance: (ms: number) => void } {
  let now = startMs;
  return {
    clock: { now: () => now },
    advance: (ms: number) => { now += ms; },
  };
}

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    const { clock } = makeMockClock();
    const cb = new CircuitBreaker(clock);
    expect(cb.isOpen('src')).toBe(false);
  });

  it('opens after 3 consecutive failures', () => {
    const { clock } = makeMockClock();
    const cb = new CircuitBreaker(clock);

    cb.recordFailure('src');
    cb.recordFailure('src');
    expect(cb.isOpen('src')).toBe(false);

    cb.recordFailure('src');
    expect(cb.isOpen('src')).toBe(true);
  });

  it('auto-closes after open duration (30s)', () => {
    const { clock, advance } = makeMockClock();
    const cb = new CircuitBreaker(clock);

    cb.recordFailure('src');
    cb.recordFailure('src');
    cb.recordFailure('src');
    expect(cb.isOpen('src')).toBe(true);

    advance(30_001);
    expect(cb.isOpen('src')).toBe(false);
  });

  it('success resets failures and closes', () => {
    const { clock } = makeMockClock();
    const cb = new CircuitBreaker(clock);

    cb.recordFailure('src');
    cb.recordFailure('src');
    cb.recordSuccess('src');
    cb.recordFailure('src');
    cb.recordFailure('src');
    expect(cb.isOpen('src')).toBe(false);
  });

  it('resets failure window after window expires (60s)', () => {
    const { clock, advance } = makeMockClock();
    const cb = new CircuitBreaker(clock);

    cb.recordFailure('src');
    cb.recordFailure('src');
    advance(60_001); // window expired
    cb.recordFailure('src');
    // only 1 failure in new window — should not open
    expect(cb.isOpen('src')).toBe(false);
  });

  it('tracks state independently per key', () => {
    const { clock } = makeMockClock();
    const cb = new CircuitBreaker(clock);

    cb.recordFailure('a');
    cb.recordFailure('a');
    cb.recordFailure('a');

    expect(cb.isOpen('a')).toBe(true);
    expect(cb.isOpen('b')).toBe(false);
  });
});
