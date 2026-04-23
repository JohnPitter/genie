import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiClient, ApiError } from '$lib/api/client';
import type { Quote, Article } from '@genie/shared';

export const load: PageLoad = async ({ params, fetch }) => {
  const ticker = params.ticker.toUpperCase();
  const client = new ApiClient({ fetch });

  let quote: Quote;
  let news: Article[];

  try {
    [quote, news] = await Promise.all([
      client.getQuote(ticker),
      client.getNewsByTicker(ticker, 20),
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 404) {
        throw error(404, `Ativo "${ticker}" não encontrado.`);
      }
      if (err.status === 503) {
        throw error(503, 'Serviço de dados temporariamente indisponível. Tente novamente.');
      }
    }
    throw error(500, 'Erro ao carregar dados do ativo.');
  }

  return { ticker, quote, news };
};
