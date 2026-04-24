import type { Editorial, Quote } from '@genie/shared';
import { ApiClient } from '$lib/api/client';

/** Coleta todos os tickers em destaque do editorial, deduplica e busca quotes. */
export async function fetchEditorialQuotes(
  editorial: Editorial,
  client: ApiClient,
): Promise<Record<string, Quote>> {
  const tickers = [...new Set(editorial.sections.flatMap(s => s.highlightTickers))].slice(0, 20);
  if (tickers.length === 0) return {};
  try {
    return await client.batchQuotes(tickers);
  } catch {
    return {};
  }
}
