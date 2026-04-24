/**
 * Calls the LLM (via OpenRouter) with pre-computed technical indicators,
 * fundamentals, and recent news to produce a structured AI analysis.
 *
 * This is a single non-streaming call — not using QueryLoop because we
 * don't need tool-calling here, just structured JSON output.
 */
import type { AIAnalysis, TechnicalIndicators } from './types.ts';
import type { Fundamentals } from './types.ts';
import { rsiLabel, macdSignal, bollingerPosition } from './indicators.ts';
import { buildModelsChain } from '../agent/llm-fallback.ts';
import type { Logger } from 'pino';

const ANALYSIS_TIMEOUT_MS = 45_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SYSTEM_PROMPT = `Você é um analista técnico e fundamentalista especializado no mercado brasileiro (B3). Analise os dados fornecidos e gere uma avaliação profissional estruturada em JSON.

REGRAS:
- Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois
- Use o formato exato especificado
- Base sua análise nos dados reais fornecidos, não em suposições
- suporte e resistencia devem ser números próximos ao preço atual
- positivos e negativos devem ter entre 2 e 4 items cada
- racional deve ter 2-3 frases objetivas em português
- NUNCA invente dados que não estão nos dados fornecidos`;

function buildPrompt(
  ticker: string,
  name: string,
  price: number,
  changePct: number,
  ind: TechnicalIndicators,
  fund: Fundamentals | null,
  newsSnippets: string[],
): string {
  const lines: string[] = [
    `=== ATIVO: ${ticker} (${name}) ===`,
    `Preço atual: R$ ${price.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% hoje)`,
    ind.high52w ? `Máxima 52 semanas: R$ ${ind.high52w.toFixed(2)}` : '',
    ind.low52w ? `Mínima 52 semanas: R$ ${ind.low52w.toFixed(2)}` : '',
    '',
    '=== INDICADORES TÉCNICOS ===',
    ind.sma20 ? `SMA 20: R$ ${ind.sma20.toFixed(2)} (preço está ${price > ind.sma20 ? 'ACIMA' : 'ABAIXO'} da média)` : 'SMA 20: indisponível',
    ind.sma50 ? `SMA 50: R$ ${ind.sma50.toFixed(2)} (tendência ${price > ind.sma50 ? 'de alta' : 'de baixa'} no médio prazo)` : 'SMA 50: indisponível',
    ind.rsi14 != null ? `RSI(14): ${ind.rsi14.toFixed(1)} — ${rsiLabel(ind.rsi14)}` : 'RSI: indisponível',
    ind.macd ? `MACD: linha=${ind.macd.line.toFixed(4)} / sinal=${ind.macd.signal.toFixed(4)} / histograma=${ind.macd.histogram.toFixed(4)} — ${macdSignal(ind.macd)}` : 'MACD: indisponível',
    ind.bollinger ? `Bollinger Bands: sup=R$${ind.bollinger.upper.toFixed(2)} / med=R$${ind.bollinger.middle.toFixed(2)} / inf=R$${ind.bollinger.lower.toFixed(2)} — ${bollingerPosition(ind.bollinger)}` : 'Bollinger: indisponível',
    ind.return30d != null ? `Retorno 30 dias: ${ind.return30d >= 0 ? '+' : ''}${ind.return30d.toFixed(1)}%` : '',
    ind.volatility30d != null ? `Volatilidade anualizada 30d: ${ind.volatility30d.toFixed(1)}%` : '',
  ].filter(Boolean);

  if (fund) {
    lines.push('', '=== FUNDAMENTOS ===');
    if (fund.pe) lines.push(`P/L: ${fund.pe.toFixed(1)}`);
    if (fund.pb) lines.push(`P/VP: ${fund.pb.toFixed(2)}`);
    if (fund.dividendYield) lines.push(`Dividend Yield: ${fund.dividendYield.toFixed(2)}%`);
    if (fund.roe) lines.push(`ROE: ${fund.roe.toFixed(1)}%`);
    if (fund.netMargin) lines.push(`Margem Líquida: ${fund.netMargin.toFixed(1)}%`);
    if (fund.debtToEquity) lines.push(`Dívida/PL: ${fund.debtToEquity.toFixed(2)}`);
  }

  if (newsSnippets.length > 0) {
    lines.push('', '=== ÚLTIMAS NOTÍCIAS ===');
    newsSnippets.slice(0, 4).forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  }

  lines.push('', '=== FORMATO DE RESPOSTA OBRIGATÓRIO ===');
  lines.push(`{
  "sinal": "compra" | "venda" | "neutro",
  "confianca": "baixa" | "media" | "alta",
  "tendencia_curto": "alta" | "lateral" | "baixa",
  "tendencia_medio": "alta" | "lateral" | "baixa",
  "suporte": <número próximo ao preço>,
  "resistencia": <número próximo ao preço>,
  "positivos": ["<fator1>", "<fator2>", "<fator3>"],
  "negativos": ["<risco1>", "<risco2>"],
  "racional": "<2-3 frases objetivas>",
  "horizonte": "1 semana" | "1 mês" | "3 meses"
}`);

  return lines.join('\n');
}

export async function analyseStock(
  ticker: string,
  name: string,
  price: number,
  changePct: number,
  indicators: TechnicalIndicators,
  fundamentals: Fundamentals | null,
  newsSnippets: string[],
  apiKey: string,
  model: string,
  log: Logger,
  modelFallback?: string,
): Promise<AIAnalysis> {
  const userPrompt = buildPrompt(ticker, name, price, changePct, indicators, fundamentals, newsSnippets);

  const models = buildModelsChain(model, modelFallback);
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 600,
    temperature: 0.2,
    stream: false,
  };
  if (models) payload.models = models;
  const body = JSON.stringify(payload);

  const attempts = 1 + RETRY_DELAYS_MS.length;
  let lastErr: Error | null = null;
  let resp: Response | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/joaopedro/genie',
          'X-Title': 'Genie',
          'Accept': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      if (r.status === 429 || r.status >= 500) {
        const preview = await r.text().catch(() => '');
        lastErr = new Error(`analyst: LLM returned HTTP ${r.status}: ${preview.slice(0, 200)}`);
        log.warn({ ticker, attempt: attempt + 1, status: r.status }, 'analyst: transient error, will retry');
      } else if (!r.ok) {
        const err = await r.text().catch(() => '');
        throw new Error(`analyst: LLM returned HTTP ${r.status}: ${err.slice(0, 200)}`);
      } else {
        resp = r;
        break;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      log.warn({ ticker, attempt: attempt + 1, err: lastErr.message }, 'analyst: fetch error, will retry');
    } finally {
      clearTimeout(timer);
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  if (!resp) {
    throw lastErr ?? new Error('analyst: all attempts failed');
  }

  const data = (await resp.json()) as { choices?: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? '';

  // Extract JSON even if the model wraps it in markdown
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log.warn({ ticker, raw: raw.slice(0, 300) }, 'analyst: LLM did not return valid JSON');
    throw new Error('analyst: could not extract JSON from LLM response');
  }

  const analysis = JSON.parse(jsonMatch[0]) as AIAnalysis;

  // Basic validation
  if (!['compra', 'venda', 'neutro'].includes(analysis.sinal)) {
    analysis.sinal = 'neutro';
  }
  if (!['baixa', 'media', 'alta'].includes(analysis.confianca)) {
    analysis.confianca = 'baixa';
  }
  if (!Array.isArray(analysis.positivos)) analysis.positivos = [];
  if (!Array.isArray(analysis.negativos)) analysis.negativos = [];

  log.info({ ticker, sinal: analysis.sinal, confianca: analysis.confianca }, 'analyst: analysis complete');
  return analysis;
}
