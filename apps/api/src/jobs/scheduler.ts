import { Cron } from 'croner';
import type { Logger } from 'pino';

export interface JobEntry {
  name: string;
  spec: string;
  nextRun: Date | null;
}

export class Scheduler {
  private readonly jobs = new Map<string, { cron: Cron; spec: string }>();
  private readonly running = new Set<string>();

  constructor(private readonly log: Logger) {}

  schedule(
    spec: string,
    name: string,
    fn: (signal: AbortSignal) => Promise<void>,
    opts: { timezone?: string } = {},
  ): void {
    const cronOpts: { protect: boolean; timezone?: string } = { protect: true };
    if (opts.timezone) cronOpts.timezone = opts.timezone;
    const cron = new Cron(spec, cronOpts, async () => {
      if (this.running.has(name)) {
        this.log.warn({ job: name }, 'job already running, skipping');
        return;
      }

      this.running.add(name);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60_000);
      const start = Date.now();

      this.log.info({ job: name }, 'job started');
      try {
        await fn(controller.signal);
        this.log.info({ job: name, durationMs: Date.now() - start }, 'job finished successfully');
      } catch (err) {
        this.log.error({ job: name, err, durationMs: Date.now() - start }, 'job finished with error');
      } finally {
        clearTimeout(timer);
        this.running.delete(name);
      }
    });

    this.jobs.set(name, { cron, spec });
    this.log.info({ job: name, spec }, 'job registered');
  }

  stop(): void {
    for (const { cron } of this.jobs.values()) {
      cron.stop();
    }
    this.log.info('scheduler stopped');
  }

  entries(): JobEntry[] {
    return [...this.jobs.entries()].map(([name, { cron, spec }]) => ({
      name,
      spec,
      nextRun: cron.nextRun(),
    }));
  }
}
