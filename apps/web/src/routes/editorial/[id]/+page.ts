import type { PageLoad } from './$types';
import { ApiClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';

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

  return {
    editorial: editorialResult.value,
    archive: archiveResult.status === 'fulfilled' ? archiveResult.value : [],
  };
};
