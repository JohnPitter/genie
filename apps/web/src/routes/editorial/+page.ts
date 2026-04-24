import type { PageLoad } from './$types';
import { ApiClient } from '$lib/api/client';
import type { Editorial, EditorialSummary, Quote } from '@genie/shared';

export const load: PageLoad = async ({ fetch }) => {
  const client = new ApiClient({ fetch });
  let editorial: Editorial | null = null;
  let archive: EditorialSummary[] = [];
  let quotes: Record<string, Quote> = {};
  let loadError: string | null = null;

  const [editorialResult, archiveResult] = await Promise.allSettled([
    client.getLatestEditorial(),
    client.listEditorials(14),
  ]);

  if (editorialResult.status === 'fulfilled') {
    editorial = editorialResult.value;
  } else {
    const err = editorialResult.reason;
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
    if (status !== 404) {
      loadError = err instanceof Error ? err.message : 'Falha ao carregar editorial.';
    }
  }

  if (archiveResult.status === 'fulfilled') {
    archive = archiveResult.value;
  }

  // quotes são carregadas em onMount na página para não bloquear a navegação
  return { editorial, archive, quotes, loadError };
};
