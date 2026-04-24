/**
 * Parsing tolerante de JSON em respostas de LLM.
 *
 * Modelos free do OpenRouter frequentemente:
 * - Embrulham JSON em ```json ... ``` (markdown fences)
 * - Adicionam preâmbulo ("Aqui está o resultado:")
 * - Truncam a resposta no meio quando max_tokens estoura
 *
 * `parseTolerantJson` lida com os 3 casos: strip de fences, busca do primeiro
 * objeto JSON, e — se truncado — tenta fechar chaves/colchetes/strings em aberto.
 */

/** Tenta parsear uma resposta de LLM como JSON, com várias estratégias. */
export function parseTolerantJson(raw: string): unknown | null {
  if (!raw || !raw.trim()) return null;

  // Estratégia 1: parse direto (resposta já é JSON puro)
  const direct = tryParse(raw.trim());
  if (direct !== null) return direct;

  // Estratégia 2: strip de markdown fences (```json ... ``` ou ``` ... ```)
  const stripped = stripCodeFences(raw);
  if (stripped !== raw) {
    const fromFenced = tryParse(stripped.trim());
    if (fromFenced !== null) return fromFenced;
  }

  // Estratégia 3: extrair primeiro objeto JSON balanceado
  const extracted = extractFirstJsonObject(stripped);
  if (extracted) {
    const fromExtracted = tryParse(extracted);
    if (fromExtracted !== null) return fromExtracted;

    // Estratégia 4: tentar fechar JSON truncado
    const repaired = repairTruncatedJson(extracted);
    if (repaired) {
      const fromRepaired = tryParse(repaired);
      if (fromRepaired !== null && hasContent(fromRepaired)) return fromRepaired;
    }
  }

  return null;
}

/** Considera o objeto reparado válido apenas se tiver pelo menos uma chave —
 *  evita aceitar `{}` quando o input era texto sem conteúdo JSON real. */
function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stripCodeFences(raw: string): string {
  // Remove ```json ... ``` ou ``` ... ``` (multiline)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1];
  return raw;
}

/**
 * Extrai o primeiro objeto JSON balanceado da string.
 * Diferente de regex greedy `{...}`, respeita strings (incluindo escapes)
 * e conta chaves abertas/fechadas — para no `}` que fecha o `{` inicial.
 *
 * Se não encontrar `}` de fechamento, retorna do `{` inicial até o fim
 * (para permitir reparo posterior).
 */
function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  // Não fechou — provavelmente truncado. Devolve o que tem para reparo.
  return raw.slice(start);
}

/**
 * Tenta consertar um JSON truncado fechando strings/arrays/objetos em aberto.
 * Estratégia conservadora: descarta o último elemento incompleto (corta no
 * último `,` ou `:` problemático) e fecha as estruturas pendentes.
 */
function repairTruncatedJson(raw: string): string | null {
  if (!raw || raw.length < 2) return null;

  let s = raw;

  // Análise de estado: stack de delimitadores abertos, está dentro de string?
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('{');
    else if (ch === '[') stack.push('[');
    else if (ch === '}' || ch === ']') {
      stack.pop();
    }
  }

  // Se já está balanceado mas falhou parse direto, não conseguimos consertar
  if (stack.length === 0 && !inString) return null;

  // Estratégia: descarta o último elemento incompleto (truncado).
  // Encontra o último ponto seguro: vírgula no nível mais interno aberto,
  // ou abertura de delimitador (deixa estrutura vazia).
  const trimmed = trimToLastSafePoint(s);
  if (!trimmed) return null;

  // Recalcula stack final após o trim e fecha pendentes
  return closeOpenStructures(trimmed);
}

function closeOpenStructures(s: string): string {
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (escapeNext) { escapeNext = false; continue; }
    if (inString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') stack.push('{');
    else if (ch === '[') stack.push('[');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let out = s;
  if (inString) out += '"';
  while (stack.length > 0) {
    const open = stack.pop()!;
    out += open === '{' ? '}' : ']';
  }
  return out;
}

/**
 * Para JSON truncado: caminha pelo input mantendo um stack de aberturas e
 * registra, para o nível mais profundo aberto, a posição do último delimitador
 * "ponto seguro" — vírgula ou a própria abertura.
 *
 * Trunca a string nesse ponto, descartando o elemento incompleto.
 */
function trimToLastSafePoint(s: string): string | null {
  let inString = false;
  let escapeNext = false;
  // Para cada delimitador aberto, guarda a posição da última vírgula vista
  // dentro dele (ou da própria abertura, se nenhuma vírgula veio depois).
  const safePoints: number[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (escapeNext) { escapeNext = false; continue; }
    if (inString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') {
      // Ponto seguro inicial: logo após a abertura (estrutura vazia)
      safePoints.push(i + 1);
    } else if (ch === '}' || ch === ']') {
      safePoints.pop();
    } else if (ch === ',' && safePoints.length > 0) {
      // Vírgula no nível atual: novo ponto seguro é logo antes dela
      safePoints[safePoints.length - 1] = i;
    }
  }

  if (safePoints.length === 0) return null;
  // Trunca no ponto seguro mais profundo (último elemento incompleto)
  const cut = safePoints[safePoints.length - 1]!;
  return s.slice(0, cut);
}
