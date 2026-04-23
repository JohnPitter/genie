import type { Source } from '../b3/source.ts';
import { B3Error } from '../b3/types.ts';
import type { Tool } from '../agent/tool.ts';
import type { Logger } from 'pino';

export function b3QuoteTool(source: Source, log: Logger): Tool {
  return {
    name: 'b3_quote',
    description: 'Retorna a cotação atual (preço, variação percentual, volume e market cap) de um ativo listado na B3.',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', pattern: '^[A-Z]{4}[0-9]{1,2}$', description: 'Código do ativo B3, ex PETR4' },
      },
      required: ['ticker'],
    },
    concurrent: true,
    handler: async (args, signal) => {
      const { ticker } = args as { ticker?: string };
      if (!ticker) return { error: "missing required argument 'ticker'" };

      const t0 = Date.now();
      try {
        const quote = await source.quote(ticker, signal);
        log.debug({ ticker, durationMs: Date.now() - t0 }, 'b3_quote executed');
        return quote;
      } catch (err) {
        if (err instanceof B3Error) {
          if (err.code === 'INVALID_TICKER') return { error: 'invalid ticker format' };
          if (err.code === 'TICKER_NOT_FOUND') return { error: 'ticker not found' };
          if (err.code === 'ALL_SOURCES_FAILED') return { error: 'all sources unavailable' };
        }
        throw err;
      }
    },
  };
}
