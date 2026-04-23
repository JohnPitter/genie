import { searchTickers, categoryOf } from '../b3/categories.ts';
import type { Tool } from '../agent/tool.ts';

export function b3SearchTickerTool(): Tool {
  return {
    name: 'b3_search_ticker',
    description: "Busca tickers da B3 por prefixo ou nome. Retorna uma lista de tickers com suas categorias setoriais. Use quando o usuário mencionar uma empresa sem saber o código exato.",
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Texto para buscar tickers na B3, ex 'PETR' ou 'petrobras'" },
      },
      required: ['query'],
    },
    concurrent: true,
    handler: async (args) => {
      const { query } = args as { query?: string };
      if (!query?.trim()) return { error: "missing required argument 'query'" };

      const tickers = searchTickers(query.trim());
      return tickers.map(t => ({ ticker: t, category: categoryOf(t) ?? '' }));
    },
  };
}
