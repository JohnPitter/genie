import type { PageLoad } from './$types';
import { ApiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { Quote } from '@genie/shared';

export const load: PageLoad = async ({ fetch, params }) => {
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw error(404, 'Edição não encontrada');
  }

  const client = new ApiClient({ fetch });
  const [editorialResult, archiveResult] = await Promise.allSettled([
    client.getEditorial(id),
    client.listEditorials(14),
  ]);

  if (editorialResult.status === 'rejected') {
    const err = editorialResult.reason;
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
    if (status === 404) throw error(404, 'Edição não encontrada');
    throw error(500, err instanceof Error ? err.message : 'Falha ao carregar edição');
  }

  const editorial = editorialResult.value;
  let quotes: Record<string, Quote> = {};

  const tickers = [
    ...new Set(editorial.sections.flatMap(s => s.highlightTickers)),
  ].slice(0, 20);

  if (tickers.length > 0) {
    try {
      quotes = await client.batchQuotes(tickers);
    } catch {
      // best-effort
    }
  }

  return {
    editorial,
    archive: archiveResult.status === 'fulfilled' ? archiveResult.value : [],
    quotes,
  };
};
