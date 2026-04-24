import type { Logger } from 'pino';
import type { EditorialCategory, EditorialSection } from './types.ts';
import { EDITORIAL_CATEGORIES } from './types.ts';
import { buildModelsChain } from '../agent/llm-fallback.ts';
import { parseTolerantJson } from '../lib/json-tolerant.ts';
import { buildEditorialPrompt, SYSTEM_PROMPT } from './prompt.ts';
import type { PromptArticle } from './store.ts';

const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

export interface GenerateInput {
  articles: PromptArticle[];
  periodLabel: string;
  apiKey: string;
  model: string;
  modelFallback?: string;
  log: Logger;
}

export interface GenerateOutput {
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
  modelUsed: string;
  tokensUsed: number | null;
}

const VALID_CATEGORIES = new Set<string>(EDITORIAL_CATEGORIES);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateEditorial(input: GenerateInput): Promise<GenerateOutput | null> {
  const { articles, periodLabel, apiKey, model, modelFallback, log } = input;
  if (articles.length === 0) {
    log.warn({ periodLabel }, 'editorial: no articles in period, skipping');
    return null;
  }

  const userPrompt = buildEditorialPrompt(articles, periodLabel);
  const validIds = new Set(articles.map(a => a.id));
  const chain = buildModelsChain(model, modelFallback) ?? [model];
  const rotation = chain.length > 0 ? chain : [model];
  const attempts = Math.max(rotation.length, 1 + RETRY_DELAYS_MS.length);

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const primary = rotation[attempt % rotation.length]!;
    const fallbacks = rotation.filter(m => m !== primary);
    const payload: Record<string, unknown> = {
      model: primary,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.4,
      stream: false,
      response_format: { type: 'json_object' },
    };
    if (fallbacks.length > 0) payload.models = [primary, ...fallbacks].slice(0, 3);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (r.status === 429 || r.status >= 500) {
        const preview = await r.text().catch(() => '');
        lastErr = new Error(`editorial: HTTP ${r.status}: ${preview.slice(0, 200)}`);
        log.warn({ attempt: attempt + 1, primary, status: r.status }, 'editorial: transient error, will retry');
      } else if (!r.ok) {
        const err = await r.text().catch(() => '');
        lastErr = new Error(`editorial: HTTP ${r.status}: ${err.slice(0, 200)}`);
        log.warn({ attempt: attempt + 1, primary, status: r.status }, 'editorial: non-retryable error');
        break;
      } else {
        const data = (await r.json().catch(() => null)) as
          | { choices?: Array<{ message: { content: string } }>; model?: string; usage?: { total_tokens?: number } }
          | null;
        const raw = data?.choices?.[0]?.message?.content ?? '';
        const parsed = parseEditorialResponse(raw, validIds);
        if (parsed) {
          log.info(
            { periodLabel, model: data?.model ?? primary, sections: parsed.sections.length },
            'editorial: generation complete',
          );
          return {
            ...parsed,
            modelUsed: data?.model ?? primary,
            tokensUsed: data?.usage?.total_tokens ?? null,
          };
        }
        lastErr = new Error('editorial: invalid JSON in LLM response');
        log.warn(
          { attempt: attempt + 1, primary, rawPreview: raw.slice(0, 200) },
          'editorial: parse failed, will rotate model',
        );
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      log.warn({ attempt: attempt + 1, primary, err: lastErr.message }, 'editorial: fetch error');
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts - 1 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }

  log.error({ err: lastErr?.message }, 'editorial: all attempts failed');
  return null;
}

export function parseEditorialResponse(
  raw: string,
  validArticleIds: Set<number>,
): { leadTitle: string; leadBody: string; sections: EditorialSection[] } | null {
  const parsed = parseTolerantJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const leadTitle = typeof obj.leadTitle === 'string' ? obj.leadTitle.trim() : '';
  const leadBody = typeof obj.leadBody === 'string' ? obj.leadBody.trim() : '';
  if (!leadTitle || !leadBody) return null;

  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const sections: EditorialSection[] = [];

  for (const s of rawSections) {
    if (!s || typeof s !== 'object') continue;
    const sec = s as Record<string, unknown>;
    const category = typeof sec.category === 'string' ? sec.category : '';
    if (!VALID_CATEGORIES.has(category)) continue;

    const title = typeof sec.title === 'string' ? sec.title.trim() : '';
    const body = typeof sec.body === 'string' ? sec.body.trim() : '';
    if (!title || !body) continue;

    const highlightTickers = Array.isArray(sec.highlightTickers)
      ? sec.highlightTickers
          .filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= 8)
          .map(t => t.toUpperCase())
          .slice(0, 5)
      : [];

    const sourceArticleIds = Array.isArray(sec.sourceArticleIds)
      ? sec.sourceArticleIds
          .filter((n): n is number => Number.isInteger(n))
          .filter(id => validArticleIds.has(id))
          .slice(0, 4)
      : [];

    sections.push({
      category: category as EditorialCategory,
      title: title.slice(0, 100),
      body,
      highlightTickers,
      sourceArticleIds,
    });
  }

  if (sections.length === 0) return null;

  return {
    leadTitle: leadTitle.slice(0, 120),
    leadBody,
    sections,
  };
}
