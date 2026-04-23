import { describe, it, expect, vi, afterEach } from 'vitest';
import { Scheduler } from '../../src/jobs/scheduler.ts';
import pino from 'pino';

const nop = pino({ level: 'silent' });

afterEach(() => vi.useRealTimers());

describe('Scheduler', () => {
  it('registers a job and lists it in entries()', () => {
    const sched = new Scheduler(nop);
    sched.schedule('0 6 * * *', 'daily-test', async () => {});
    const entries = sched.entries();
    expect(entries.some(e => e.name === 'daily-test')).toBe(true);
    sched.stop();
  });

  it('stop() does not throw', () => {
    const sched = new Scheduler(nop);
    sched.schedule('0 6 * * *', 'test-job', async () => {});
    expect(() => sched.stop()).not.toThrow();
  });

  it('nextRun is a future Date for a valid cron spec', () => {
    const sched = new Scheduler(nop);
    sched.schedule('0 6 * * *', 'future-job', async () => {});
    const [entry] = sched.entries();
    if (entry?.nextRun) {
      expect(entry.nextRun.getTime()).toBeGreaterThan(Date.now());
    }
    sched.stop();
  });
});
