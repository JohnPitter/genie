/** In-memory circular-buffer metrics store for Golden Signals. No external deps. */

interface RequestSample {
  ts: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

export interface GoldenSignals {
  latency: { p50: number; p95: number; p99: number; avg: number };
  traffic: {
    rpm: number;
    total: number;
    byMethod: Record<string, number>;
    topPaths: Array<{ path: string; count: number }>;
  };
  errors: {
    rate: number;
    total4xx: number;
    total5xx: number;
    recentErrors: Array<{ path: string; status: number; ts: number }>;
  };
  saturation: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    uptimeSeconds: number;
    pid: number;
  };
  meta: { windowMinutes: number; samples: number; since: string };
}

const MAX_SAMPLES = 2_000;
const WINDOW_MINUTES = 60;
const startedAt = Date.now();
const buffer: RequestSample[] = [];

export function recordRequest(sample: Omit<RequestSample, 'ts'>): void {
  buffer.push({ ts: Date.now(), ...sample });
  if (buffer.length > MAX_SAMPLES) buffer.shift();
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)] ?? 0;
}

export function getGoldenSignals(): GoldenSignals {
  const now = Date.now();
  const cutoff = now - WINDOW_MINUTES * 60_000;
  const samples = buffer.filter(s => s.ts >= cutoff);

  // Latency
  const durations = samples.map(s => s.durationMs).sort((a, b) => a - b);
  const avg = durations.length > 0
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : 0;

  // Traffic
  const byMethod: Record<string, number> = {};
  const pathCounts: Record<string, number> = {};
  for (const s of samples) {
    byMethod[s.method] = (byMethod[s.method] ?? 0) + 1;
    pathCounts[s.path] = (pathCounts[s.path] ?? 0) + 1;
  }
  const topPaths = Object.entries(pathCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([path, count]) => ({ path, count }));

  const fiveMinCount = buffer.filter(s => s.ts >= now - 5 * 60_000).length;
  const rpm = Math.round(fiveMinCount / 5);

  // Errors
  const e4xx = samples.filter(s => s.status >= 400 && s.status < 500);
  const e5xx = samples.filter(s => s.status >= 500);
  const allErrors = [...e4xx, ...e5xx];
  const rate = samples.length > 0
    ? Math.round((allErrors.length / samples.length) * 10_000) / 100
    : 0;

  // Saturation
  const mem = process.memoryUsage();

  return {
    latency: {
      p50: Math.round(pct(durations, 50)),
      p95: Math.round(pct(durations, 95)),
      p99: Math.round(pct(durations, 99)),
      avg,
    },
    traffic: { rpm, total: samples.length, byMethod, topPaths },
    errors: {
      rate,
      total4xx: e4xx.length,
      total5xx: e5xx.length,
      recentErrors: allErrors
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 8)
        .map(s => ({ path: s.path, status: s.status, ts: s.ts })),
    },
    saturation: {
      heapUsedMB: Math.round(mem.heapUsed / 1_048_576),
      heapTotalMB: Math.round(mem.heapTotal / 1_048_576),
      rssMB: Math.round(mem.rss / 1_048_576),
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
    },
    meta: {
      windowMinutes: WINDOW_MINUTES,
      samples: samples.length,
      since: new Date(Math.max(cutoff, startedAt)).toISOString(),
    },
  };
}
