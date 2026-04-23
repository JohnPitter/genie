import { B3Error, isAllSourcesFailed } from './types.ts';
import type { Quote, Fundamentals } from './types.ts';
import { validateTicker } from './source.ts';
import type { Source } from './source.ts';
import { TTLCache } from './cache.ts';
import { CircuitBreaker } from './breaker.ts';
import type { Logger } from 'pino';

const QUOTE_TTL_MS = 5 * 60_000;        // 5 minutes
const FUNDAMENTALS_TTL_MS = 24 * 60 * 60_000; // 24 hours
const WARMUP_CONCURRENCY = 8;

export class Cascade implements Source {
  private readonly quoteCache = new TTLCache<Quote>();
  private readonly fundamentalsCache = new TTLCache<Fundamentals>();
  private readonly breaker = new CircuitBreaker();

  constructor(
    private readonly sources: Source[],
    private readonly log: Logger,
  ) {}

  name(): string {
    return 'cascade';
  }

  async quote(ticker: string, signal?: AbortSignal): Promise<Quote> {
    validateTicker(ticker);

    const cached = this.quoteCache.get(`quote:${ticker}`);
    if (cached) {
      this.log.debug({ ticker }, 'quote cache hit');
      return cached;
    }

    for (const src of this.sources) {
      if (this.breaker.isOpen(src.name())) {
        this.log.warn({ source: src.name() }, 'circuit open, skipping source');
        continue;
      }

      const t0 = Date.now();
      try {
        const q = await src.quote(ticker, signal);
        this.quoteCache.set(`quote:${ticker}`, q, QUOTE_TTL_MS);
        this.breaker.recordSuccess(src.name());
        this.log.info({ source: src.name(), ticker, durationMs: Date.now() - t0 }, 'quote success');
        return q;
      } catch (err) {
        this.log.warn({ source: src.name(), ticker, err }, 'quote failed, trying next source');
        this.breaker.recordFailure(src.name());
      }
    }

    throw new B3Error('ALL_SOURCES_FAILED', `b3: all sources failed: ticker=${ticker}`);
  }

  async fundamentals(ticker: string, signal?: AbortSignal): Promise<Fundamentals> {
    validateTicker(ticker);

    const cached = this.fundamentalsCache.get(`fundamentals:${ticker}`);
    if (cached) {
      this.log.debug({ ticker }, 'fundamentals cache hit');
      return cached;
    }

    for (const src of this.sources) {
      if (this.breaker.isOpen(src.name())) {
        this.log.warn({ source: src.name() }, 'circuit open, skipping source');
        continue;
      }

      const t0 = Date.now();
      try {
        const f = await src.fundamentals(ticker, signal);
        this.fundamentalsCache.set(`fundamentals:${ticker}`, f, FUNDAMENTALS_TTL_MS);
        this.breaker.recordSuccess(src.name());
        this.log.info({ source: src.name(), ticker, durationMs: Date.now() - t0 }, 'fundamentals success');
        return f;
      } catch (err) {
        this.log.warn({ source: src.name(), ticker, err }, 'fundamentals failed, trying next source');
        this.breaker.recordFailure(src.name());
      }
    }

    throw new B3Error('ALL_SOURCES_FAILED', `b3: all sources failed: ticker=${ticker}`);
  }

  async warmupQuotes(tickers: string[], signal?: AbortSignal): Promise<void> {
    const sem = new Semaphore(WARMUP_CONCURRENCY);
    await Promise.all(
      tickers.map(ticker =>
        sem.run(async () => {
          try {
            await this.quote(ticker, signal);
          } catch (err) {
            if (!isAllSourcesFailed(err)) throw err;
            this.log.warn({ ticker, err }, 'warmup: quote failed');
          }
        }),
      ),
    );
  }

  stop(): void {
    this.quoteCache.stop();
    this.fundamentalsCache.stop();
  }
}

class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}
