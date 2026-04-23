/**
 * Benchmark de modelos OpenRouter no contexto real do Genie.
 *
 * Mede TTFT (time-to-first-token), duração total, taxa de tokens/seg,
 * qualidade básica (usou tool? retornou JSON válido?) para decidir qual modelo
 * usa como primário/fallback.
 *
 * Rodar: cd apps/api && node_modules/.bin/tsx src/scripts/bench-models.ts
 */
import 'dotenv/config';
import { SYSTEM_PROMPT } from '../agent/prompt.ts';
import { getConfig } from '../lib/config.ts';

const MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-3-27b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'minimax/minimax-m2.5:free',
  'tencent/hy3-preview:free',
];

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'b3_quote',
      description: 'Retorna a cotação atual de um ticker da B3.',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string', description: 'ex: PETR4' } },
        required: ['ticker'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'b3_fundamentals',
      description: 'Retorna fundamentos (PL, ROE, DY, etc) de um ticker.',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' } },
        required: ['ticker'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Busca na web por notícias / informações.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, max_results: { type: 'integer' } },
        required: ['query'],
      },
    },
  },
];

const SCENARIOS = [
  { name: 'saudação', prompt: 'oi, tudo bem?' },
  { name: 'pergunta-ativo', prompt: 'me fala sobre a PETR4' },
];

interface Result {
  model: string;
  scenario: string;
  ttftMs: number;
  totalMs: number;
  outputChars: number;
  toolCalled: boolean;
  toolName: string;
  error: string | null;
}

async function runOne(
  model: string,
  scenario: { name: string; prompt: string },
  apiKey: string,
): Promise<Result> {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: scenario.prompt },
    ],
    tools: TOOLS,
    stream: true,
  };

  const start = Date.now();
  let firstTokenAt = 0;
  let content = '';
  let toolName = '';
  let error: string | null = null;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/joaopedro/genie',
        'X-Title': 'Genie-Bench',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        model, scenario: scenario.name, ttftMs: 0, totalMs: Date.now() - start,
        outputChars: 0, toolCalled: false, toolName: '', error: `HTTP ${resp.status}: ${text.slice(0, 120)}`,
      };
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          const text = delta.content ?? '';
          const tc = delta.tool_calls?.[0];

          if ((text || tc) && firstTokenAt === 0) firstTokenAt = Date.now();
          if (text) content += text;
          if (tc?.function?.name) toolName = tc.function.name;
        } catch {
          /* skip */
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const totalMs = Date.now() - start;
  const ttftMs = firstTokenAt > 0 ? firstTokenAt - start : totalMs;

  return {
    model,
    scenario: scenario.name,
    ttftMs,
    totalMs,
    outputChars: content.length,
    toolCalled: toolName !== '',
    toolName,
    error,
  };
}

function fmt(n: number, unit = 'ms'): string {
  if (unit === 'ms') return `${(n / 1000).toFixed(2)}s`;
  return String(n);
}

async function main() {
  const config = getConfig();
  const apiKey = config.OPENROUTER_API_KEY;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Genie — Benchmark de modelos OpenRouter (FREE tier)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allResults: Result[] = [];

  for (const model of MODELS) {
    console.log(`\n▶ ${model}`);
    for (const scenario of SCENARIOS) {
      process.stdout.write(`  ${scenario.name.padEnd(18)} `);
      const r = await runOne(model, scenario, apiKey);
      allResults.push(r);
      if (r.error) {
        console.log(`❌ ${r.error}`);
      } else {
        const toolTag = r.toolCalled ? `🔧 ${r.toolName}` : '💬 texto';
        console.log(
          `TTFT ${fmt(r.ttftMs).padStart(6)}  total ${fmt(r.totalMs).padStart(6)}  out ${String(r.outputChars).padStart(4)}ch  ${toolTag}`,
        );
      }
      // Delay pequeno entre calls para não trigger rate-limit
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── Ranking consolidado ──────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  RANKING (menor TTFT médio = melhor)');
  console.log('═══════════════════════════════════════════════════════════════');

  const byModel = new Map<string, Result[]>();
  for (const r of allResults) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model)!.push(r);
  }

  const ranked = Array.from(byModel.entries()).map(([model, rs]) => {
    const ok = rs.filter(r => !r.error);
    const avgTTFT = ok.length ? ok.reduce((s, r) => s + r.ttftMs, 0) / ok.length : Infinity;
    const avgTotal = ok.length ? ok.reduce((s, r) => s + r.totalMs, 0) / ok.length : Infinity;
    const errors = rs.length - ok.length;
    return { model, avgTTFT, avgTotal, errors, samples: rs.length };
  });
  ranked.sort((a, b) => a.avgTTFT - b.avgTTFT);

  ranked.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    console.log(
      `${medal} ${r.model.padEnd(50)}  TTFT ${fmt(r.avgTTFT).padStart(7)}  total ${fmt(r.avgTotal).padStart(7)}  erros ${r.errors}/${r.samples}`,
    );
  });

  console.log('\n─── sugestão para .env ───');
  if (ranked.length >= 2) {
    console.log(`OPENROUTER_MODEL=${ranked[0]!.model}`);
    const fallbacks = ranked.slice(1).map(r => r.model).join(',');
    console.log(`OPENROUTER_MODEL_FALLBACK=${fallbacks}`);
  }
}

main().catch(err => {
  console.error('bench failed:', err);
  process.exit(1);
});
