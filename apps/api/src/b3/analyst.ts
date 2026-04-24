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
        lastErr = new Error(`analyst: LLM returned HTTP ${r.status}: ${err.slice(0, 200)}`);
        break;
      } else {
        const data = (await r.json().catch(() => null)) as
          | { choices?: Array<{ message: { content: string } }> }
          | null;
        const raw = data?.choices?.[0]?.message?.content ?? '';
        const parsed = tryParseAnalysis(raw);
        if (parsed) {
          log.info({ ticker, sinal: parsed.sinal, confianca: parsed.confianca }, 'analyst: analysis complete');
          return parsed;
        }
        lastErr = new Error('analyst: LLM returned empty/invalid JSON');
        log.warn({ ticker, attempt: attempt + 1, rawPreview: raw.slice(0, 200) }, 'analyst: invalid LLM response, will retry');
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

  // All attempts failed — return deterministic fallback based on indicators
  // so the user always gets some useful analysis instead of an error.
  log.warn(
    { ticker, err: lastErr?.message },
    'analyst: all LLM attempts failed, returning deterministic fallback',
  );
  return buildFallbackAnalysis(price, indicators, fundamentals);
}

/** Try to extract + validate a JSON analysis from the LLM raw response. */
function tryParseAnalysis(raw: string): AIAnalysis | null {
  if (!raw || !raw.trim()) return null;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as AIAnalysis;
    if (!['compra', 'venda', 'neutro'].includes(parsed.sinal)) parsed.sinal = 'neutro';
    if (!['baixa', 'media', 'alta'].includes(parsed.confianca)) parsed.confianca = 'baixa';
    if (!Array.isArray(parsed.positivos)) parsed.positivos = [];
    if (!Array.isArray(parsed.negativos)) parsed.negativos = [];
    return parsed;
  } catch {
    return null;
  }
}

/** Deterministic analysis baseada apenas nos indicadores — usada quando o LLM
 *  está indisponível. Transparente: confiança sempre 'baixa' para sinalizar
 *  que não houve análise IA real. */
function buildFallbackAnalysis(
  price: number,
  ind: TechnicalIndicators,
  fund: Fundamentals | null,
): AIAnalysis {
  const positivos: string[] = [];
  const negativos: string[] = [];

  // RSI
  if (ind.rsi14 != null) {
    if (ind.rsi14 < 30) positivos.push(`RSI em ${ind.rsi14.toFixed(0)} — zona de sobrevendido, possível reversão`);
    else if (ind.rsi14 > 70) negativos.push(`RSI em ${ind.rsi14.toFixed(0)} — zona de sobrecomprado`);
  }

  // Médias móveis
  if (ind.sma20 && price > ind.sma20) positivos.push('Preço acima da média móvel de 20 dias (tendência curta positiva)');
  else if (ind.sma20 && price < ind.sma20) negativos.push('Preço abaixo da média móvel de 20 dias');

  if (ind.sma50 && price > ind.sma50) positivos.push('Preço acima da média de 50 dias (tendência média positiva)');
  else if (ind.sma50 && price < ind.sma50) negativos.push('Preço abaixo da média de 50 dias');

  // MACD
  if (ind.macd) {
    if (ind.macd.histogram > 0) positivos.push('MACD histograma positivo (momentum de alta)');
    else negativos.push('MACD histograma negativo (momentum de baixa)');
  }

  // Fundamentos
  if (fund?.dividendYield && fund.dividendYield > 5) {
    positivos.push(`Dividend Yield de ${fund.dividendYield.toFixed(1)}% acima da média`);
  }
  if (fund?.debtToEquity && fund.debtToEquity > 2) {
    negativos.push(`Dívida/Patrimônio alta (${fund.debtToEquity.toFixed(1)})`);
  }

  // Sinal derivado do score simples
  const score = positivos.length - negativos.length;
  const sinal: AIAnalysis['sinal'] = score >= 2 ? 'compra' : score <= -2 ? 'venda' : 'neutro';

  const tendencia: AIAnalysis['tendencia_curto'] =
    ind.sma20 && price > ind.sma20 ? 'alta' : ind.sma20 && price < ind.sma20 ? 'baixa' : 'lateral';
  const tendenciaMedio: AIAnalysis['tendencia_medio'] =
    ind.sma50 && price > ind.sma50 ? 'alta' : ind.sma50 && price < ind.sma50 ? 'baixa' : 'lateral';

  // Suporte/resistência aproximados: preço ± 5% arredondado
  const suporte = Math.round(price * 0.95 * 100) / 100;
  const resistencia = Math.round(price * 1.05 * 100) / 100;

  if (positivos.length === 0) positivos.push('Dados técnicos disponíveis para acompanhamento');
  if (negativos.length === 0) negativos.push('Análise IA indisponível no momento — revise indicadores manualmente');

  return {
    sinal,
    confianca: 'baixa',
    tendencia_curto: tendencia,
    tendencia_medio: tendenciaMedio,
    suporte,
    resistencia,
    positivos: positivos.slice(0, 4),
    negativos: negativos.slice(0, 4),
    racional:
      'Análise automática baseada em indicadores técnicos (IA temporariamente indisponível). ' +
      'Considere este resultado como apoio, não como recomendação definitiva.',
    horizonte: '1 mês',
  };
}
