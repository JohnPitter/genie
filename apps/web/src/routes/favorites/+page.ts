import type { PageLoad } from './$types';
import { ApiClient } from '$lib/api/client';
import type { FavoriteEnriched } from '@genie/shared';

export const load: PageLoad = async ({ fetch }) => {
  const client = new ApiClient({ fetch });
  let items: FavoriteEnriched[] = [];

  try {
    items = await client.getFavorites(true);
  } catch {
    // Return empty — the page handles the error state via the store.
    items = [];
  }

  return { items };
};
