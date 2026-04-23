import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(5858),
  DB_PATH: z.string().default('genie.db'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-3.5-haiku'),
  /** Optional fallback model — used automatically by OpenRouter if the primary
   * model fails (rate limit, 5xx, unavailable). Leave empty to disable. */
  OPENROUTER_MODEL_FALLBACK: z.string().optional(),
  WEB_SEARCH_API_KEY: z.string().optional(),
  ADMIN_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof schema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${errors}`);
  }
  _config = result.data;
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
