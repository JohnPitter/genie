export const USER_AGENT = 'Mozilla/5.0 (Genie/1.0; +https://github.com/joaopedro/genie)';
export const DEFAULT_TIMEOUT_MS = 10_000;
export const SCRAPER_TIMEOUT_MS = 15_000;

export function buildHeaders(accept = 'application/json'): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    'Accept': accept,
  };
}

export async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  externalSignal?: AbortSignal | null,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = externalSignal
    ? AbortSignal.any([externalSignal, controller.signal])
    : controller.signal;

  try {
    return await fetch(url, { headers, signal });
  } finally {
    clearTimeout(timer);
  }
}
