import { addFavorite, removeFavorite, listFavorites } from '../store/favorites.ts';
import { validateTicker } from '../b3/source.ts';
import { B3Error } from '../b3/types.ts';
import type { Tool } from '../agent/tool.ts';
import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';

const tickerSchema = {
  type: 'object',
  properties: {
    ticker: { type: 'string', pattern: '^[A-Z]{4}[0-9]{1,2}$', description: 'Código do ativo B3 a favoritar, ex PETR4' },
  },
  required: ['ticker'],
};

export function favoritesTools(db: DB, log: Logger): Tool[] {
  return [
    {
      name: 'favorite_add',
      description: 'Adiciona um ativo B3 à lista de favoritos do usuário para monitoramento contínuo.',
      schema: tickerSchema,
      concurrent: false,
      handler: async (args) => {
        const { ticker } = args as { ticker?: string };
        if (!ticker) return { error: "missing required argument 'ticker'" };
        try {
          validateTicker(ticker);
        } catch (err) {
          if (err instanceof B3Error) return { error: 'invalid ticker format' };
          throw err;
        }
        addFavorite(db, ticker);
        log.info({ ticker }, 'favorite added');
        return { status: 'added', ticker };
      },
    },
    {
      name: 'favorite_remove',
      description: 'Remove um ativo B3 da lista de favoritos do usuário.',
      schema: tickerSchema,
      concurrent: false,
      handler: async (args) => {
        const { ticker } = args as { ticker?: string };
        if (!ticker) return { error: "missing required argument 'ticker'" };
        removeFavorite(db, ticker);
        log.info({ ticker }, 'favorite removed');
        return { status: 'removed', ticker };
      },
    },
    {
      name: 'favorite_list',
      description: 'Lista todos os ativos B3 favoritados pelo usuário, com data de adição.',
      schema: { type: 'object', properties: {}, required: [] },
      concurrent: true,
      handler: async () => {
        const favorites = listFavorites(db);
        log.debug({ count: favorites.length }, 'favorite_list executed');
        return favorites;
      },
    },
  ];
}
