const FAILURE_THRESHOLD = 3;
const WINDOW_MS = 60_000;
const OPEN_DURATION_MS = 30_000;

interface BreakerState {
  failures: number;
  windowStart: number;
  openedAt: number;
  isOpen: boolean;
}

// Clock abstraction for deterministic testing.
export interface Clock {
  now(): number;
}

export const realClock: Clock = { now: () => Date.now() };

export class CircuitBreaker {
  private readonly states = new Map<string, BreakerState>();

  constructor(private readonly clock: Clock = realClock) {}

  isOpen(key: string): boolean {
    const s = this.states.get(key);
    if (!s || !s.isOpen) return false;

    if (this.clock.now() > s.openedAt + OPEN_DURATION_MS) {
      s.isOpen = false;
      s.failures = 0;
      return false;
    }

    return true;
  }

  recordFailure(key: string): void {
    const s = this.getOrCreate(key);
    const now = this.clock.now();

    if (now > s.windowStart + WINDOW_MS) {
      s.failures = 0;
      s.windowStart = now;
    }

    s.failures++;
    if (s.failures >= FAILURE_THRESHOLD) {
      s.isOpen = true;
      s.openedAt = now;
    }
  }

  recordSuccess(key: string): void {
    const s = this.getOrCreate(key);
    s.failures = 0;
    s.isOpen = false;
  }

  private getOrCreate(key: string): BreakerState {
    let s = this.states.get(key);
    if (!s) {
      s = { failures: 0, windowStart: this.clock.now(), openedAt: 0, isOpen: false };
      this.states.set(key, s);
    }
    return s;
  }
}
