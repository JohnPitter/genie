/**
 * Lógica compartilhada de fallback de modelos do OpenRouter.
 *
 * Toda função que chama um LLM deve usar `buildModelsChain()` para construir
 * o array `models` da requisição — garante retry automático pelo OpenRouter
 * quando o provider primário retorna 429/5xx ou fica indisponível.
 *
 * OpenRouter aceita no máximo 3 modelos por request. Se o primário for um
 * modelo `:free` e o usuário não configurou fallbacks, aplicamos uma cascata
 * de emergência baseada no benchmark (bench-models.ts).
 */

/** Máximo de modelos aceitos pelo OpenRouter no array `models`. */
export const MAX_MODELS = 3;

/** Cascata de fallback automática para deploys que usam modelo `:free` sem
 *  `OPENROUTER_MODEL_FALLBACK` configurado. Ordem: estáveis + rápidos primeiro. */
export const EMERGENCY_FREE_FALLBACKS = [
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
];

/**
 * Constrói a cadeia de modelos para o campo `models` do payload OpenRouter.
 *
 * @param primary Modelo primário (obrigatório)
 * @param fallback String CSV OU array de modelos de fallback (opcional)
 * @returns Array com [primary, ...fallbacks] limitado a MAX_MODELS, ou undefined
 *          se não houver fallback algum (primário não `:free` + sem config).
 */
export function buildModelsChain(
  primary: string,
  fallback?: string | string[],
): string[] | undefined {
  const configured = Array.isArray(fallback)
    ? fallback.map(s => s.trim()).filter(s => s.length > 0)
    : typeof fallback === 'string'
      ? fallback.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

  if (configured.length > 0) {
    return [primary, ...configured].slice(0, MAX_MODELS);
  }

  if (primary.endsWith(':free')) {
    const auto = EMERGENCY_FREE_FALLBACKS.filter(m => m !== primary);
    return [primary, ...auto].slice(0, MAX_MODELS);
  }

  return undefined;
}
