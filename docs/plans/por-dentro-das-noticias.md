# Plano de Implementação — Por Dentro das Notícias

> **Status:** proposto
> **Data:** 2026-04-24
> **Tipo:** Feature complexa (backend + frontend + job + LLM + persistência)

---

## 1. Objetivo

Criar uma página editorial financeira automatizada por IA que sumariza e investiga as notícias do dia em formato de "edições" diárias (4 edições: 08h, 12h, 16h, 20h BRT). Cada edição contém um lead (manchete síntese), análise investigativa por categoria e referências às notícias-fonte. Edições antigas ficam acessíveis em arquivo. Em caso de falha de uma edição, a anterior continua disponível e a página exibe a edição mais recente bem-sucedida.

**Por que:** as notícias se atualizam de hora em hora, mas o usuário não tem tempo de ler tudo. Um editorial periódico oferece (a) síntese curada, (b) explicação do *porquê* dos movimentos, (c) leitura ritmada — característica valiosa de um produto financeiro premium e diferenciada vs. agregadores genéricos.

---

## 2. Escopo / Não-escopo

**Escopo:**
- Geração de 4 edições/dia via cron (08h, 12h, 16h, 20h BRT)
- Persistência em SQLite (`news_editorials`) com histórico completo
- 1 chamada LLM única por edição (JSON estruturado coeso, mais barato que 7 chamadas)
- Reaproveitamento de `buildModelsChain` para fallback de modelos
- Endpoint REST `GET /api/editorials` (lista) e `GET /api/editorials/:id` (detalhe)
- Nova rota `/editorial` no frontend SvelteKit
- Item no Sidebar entre Favoritos e Rankings
- Resiliência: se geração falha, edição anterior segue disponível; UI mostra última edição válida

**Não-escopo (V1):**
- Notificações push de nova edição
- Compartilhamento social
- Edição manual / curadoria humana
- Versionamento ou edição retroativa de edições passadas
- Multi-idioma (apenas pt-BR)

---

## 3. Arquitetura

### Fluxo de geração (job cron)

```
Cron (08/12/16/20h BRT)
  → EditorialJob.run()
    → Carrega notícias das últimas N horas (8h para 1ª edição, 4h para demais)
    → Agrupa por categoria (7 categorias)
    → Monta prompt único com manchetes + tickers
    → Chama OpenRouter (com models chain)
    → Parseia JSON estruturado (lead + 7 seções)
    → INSERT em news_editorials
    → Salva referência aos article_ids usados (M:N via JSON)
    → Em caso de falha total: log warn, NÃO insere, edição anterior segue valendo
```

### Fluxo de leitura (frontend)

```
GET /editorial
  → Carrega edição mais recente (qualquer status='ok')
  → Header com período coberto + próxima edição
  → Lead em destaque
  → 7 cards por categoria (cada um com parágrafo IA + 2-3 manchetes-fonte)
  → Sidebar lateral: arquivo das últimas 14 edições (≈ 3-4 dias)
GET /editorial/:id  (clique em edição arquivada)
  → Mesma estrutura mas para edição específica
```

---

## 4. Arquivos afetados

| Arquivo | Ação | Descrição |
|---|---|---|
| `apps/api/src/store/migrations/006_news_editorials.sql` | **criar** | Schema da tabela `news_editorials` |
| `packages/shared/src/types.ts` | **modificar** | Adicionar `Editorial`, `EditorialSection`, `EditorialSlot` |
| `apps/api/src/editorial/types.ts` | **criar** | Types internos de prompt/resposta IA |
| `apps/api/src/editorial/prompt.ts` | **criar** | Builder do prompt único estruturado |
| `apps/api/src/editorial/generator.ts` | **criar** | Lógica de geração (chama LLM, parseia, valida) |
| `apps/api/src/editorial/store.ts` | **criar** | CRUD da tabela `news_editorials` |
| `apps/api/src/editorial/service.ts` | **criar** | Service público (latest, byId, list) |
| `apps/api/src/jobs/editorial_refresh.ts` | **criar** | Job que chama generator + store |
| `apps/api/src/jobs/registrar.ts` | **modificar** | Registrar `editorial-refresh` em 4 horários |
| `apps/api/src/server/routes/editorials.ts` | **criar** | Rotas REST `GET /api/editorials` e `/api/editorials/:id` |
| `apps/api/src/server/index.ts` (ou onde rotas são montadas) | **modificar** | Registrar novo route plugin |
| `apps/api/src/main.ts` | **modificar** | Instanciar EditorialService e passar para registrar jobs/rotas |
| `apps/web/src/lib/api/editorial.ts` | **criar** | Client SvelteKit para `/api/editorials` |
| `apps/web/src/lib/components/editorial/EditorialHeader.svelte` | **criar** | Cabeçalho da edição (título, hora, próxima) |
| `apps/web/src/lib/components/editorial/EditorialLead.svelte` | **criar** | Lead em destaque |
| `apps/web/src/lib/components/editorial/EditorialSection.svelte` | **criar** | Card por categoria (texto IA + manchetes) |
| `apps/web/src/lib/components/editorial/EditorialArchive.svelte` | **criar** | Sidebar de edições anteriores |
| `apps/web/src/routes/editorial/+page.svelte` | **criar** | Página principal (edição mais recente) |
| `apps/web/src/routes/editorial/+page.ts` | **criar** | Loader SSR (busca latest) |
| `apps/web/src/routes/editorial/[id]/+page.svelte` | **criar** | Página de edição arquivada |
| `apps/web/src/routes/editorial/[id]/+page.ts` | **criar** | Loader SSR por id |
| `apps/web/src/lib/components/layout/Sidebar.svelte` | **modificar** | Adicionar item "Editorial" entre Favoritos e Rankings |
| `apps/api/test/editorial/generator.test.ts` | **criar** | Unit tests do parser/validator |
| `apps/api/test/editorial/store.test.ts` | **criar** | Unit tests da camada de persistência |
| `apps/api/test/jobs/editorial_refresh.test.ts` | **criar** | Test do job (mock LLM) |
| `CHANGELOG.md` | **modificar** | Entrada da feature |

---

## 5. Snippets-chave

### 5.1 Migration `006_news_editorials.sql`

```sql
-- Migration 006: news_editorials — editoriais financeiros gerados por IA
-- 4 edições/dia (08, 12, 16, 20 BRT). Falhas não inserem; UI cai na última válida.

CREATE TABLE IF NOT EXISTS news_editorials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slot            TEXT NOT NULL,                  -- '08' | '12' | '16' | '20' (hora BRT)
    edition_date    TEXT NOT NULL,                  -- 'YYYY-MM-DD' (data BRT da edição)
    period_start    DATETIME NOT NULL,              -- início do período coberto (UTC)
    period_end      DATETIME NOT NULL,              -- fim do período coberto (UTC)
    lead_title      TEXT NOT NULL,                  -- manchete síntese
    lead_body       TEXT NOT NULL,                  -- parágrafo de abertura (3-5 linhas)
    sections_json   TEXT NOT NULL,                  -- JSON: EditorialSection[]
    article_ids_json TEXT NOT NULL DEFAULT '[]',    -- JSON array: IDs de news_articles referenciados
    model_used      TEXT,                           -- modelo OpenRouter que respondeu
    tokens_used     INTEGER,                        -- custo aproximado (se disponível)
    status          TEXT NOT NULL DEFAULT 'ok',     -- 'ok' | 'failed' (falhas geralmente nem inseridas)
    generated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(edition_date, slot)                      -- 1 edição por slot/dia
);

CREATE INDEX IF NOT EXISTS idx_editorials_generated ON news_editorials(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_editorials_date_slot ON news_editorials(edition_date DESC, slot DESC);
```

### 5.2 Types em `packages/shared/src/types.ts`

```ts
export type EditorialSlot = '08' | '12' | '16' | '20';

export interface EditorialSection {
  category: NewsCategory;          // reusa enum existente (financeiro|commodities|...)
  title: string;                   // título da seção (ex: "Energia sob pressão do petróleo")
  body: string;                    // 2-4 frases investigativas/explicativas
  highlightTickers: string[];      // tickers em destaque (max 5)
  sourceArticleIds: number[];      // IDs de news_articles citadas
}

export interface Editorial {
  id: number;
  slot: EditorialSlot;
  editionDate: string;             // 'YYYY-MM-DD'
  periodStart: string;             // ISO UTC
  periodEnd: string;               // ISO UTC
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
  modelUsed: string | null;
  generatedAt: string;             // ISO UTC
}

export interface EditorialSummary {  // versão lista (sem sections completas)
  id: number;
  slot: EditorialSlot;
  editionDate: string;
  leadTitle: string;
  generatedAt: string;
}
```

### 5.3 Prompt builder (`apps/api/src/editorial/prompt.ts`)

```ts
import type { NewsCategory } from '@genie/shared';

export interface PromptArticle {
  id: number;
  title: string;
  source: string | null;
  category: NewsCategory | null;
  tickers: string[];
  publishedAt: string | null;
}

export const SYSTEM_PROMPT = `Você é o editor-chefe de um boletim financeiro brasileiro premium. Seu trabalho é transformar uma pilha de manchetes em um editorial INVESTIGATIVO e EXPLICATIVO — não um agregador.

REGRAS:
- Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois
- O LEAD deve conectar o tema dominante do período em 3-5 frases (manchete + abertura)
- Cada SEÇÃO deve EXPLICAR o que está acontecendo na categoria, não só listar — busque relações causais entre notícias
- Cite tickers concretos quando relevante
- Use português brasileiro formal-jornalístico, evite jargão raso
- NUNCA invente fatos: baseie-se SÓ nas manchetes fornecidas
- Se uma categoria tiver poucas/nenhuma notícia, ainda assim retorne a seção com body curto reconhecendo "movimento discreto no período"`;

export function buildEditorialPrompt(
  articles: PromptArticle[],
  periodLabel: string,
): string {
  const byCategory = new Map<string, PromptArticle[]>();
  for (const a of articles) {
    const cat = a.category ?? 'outros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(a);
  }

  const lines: string[] = [
    `=== EDIÇÃO: ${periodLabel} ===`,
    `Total de manchetes: ${articles.length}`,
    '',
  ];

  for (const [cat, list] of byCategory) {
    lines.push(`### Categoria: ${cat} (${list.length} notícias)`);
    list.slice(0, 12).forEach(a => {
      const tickers = a.tickers.length > 0 ? ` [${a.tickers.join(', ')}]` : '';
      lines.push(`- (id=${a.id}) ${a.title} — ${a.source ?? 'fonte ?'}${tickers}`);
    });
    lines.push('');
  }

  lines.push('=== FORMATO DE RESPOSTA OBRIGATÓRIO ===');
  lines.push(`{
  "leadTitle": "<manchete síntese, max 90 caracteres>",
  "leadBody": "<3-5 frases conectando o tema dominante do período>",
  "sections": [
    {
      "category": "financeiro" | "commodities" | "varejo" | "energia" | "saneamento" | "tecnologia" | "saude",
      "title": "<título da seção, max 70 caracteres>",
      "body": "<2-4 frases investigativas/explicativas>",
      "highlightTickers": ["TICK1", "TICK2"],
      "sourceArticleIds": [<id1>, <id2>, <id3>]
    }
    // ... uma entrada por categoria com notícias relevantes (mínimo 3, máximo 7)
  ]
}`);

  return lines.join('\n');
}
```

### 5.4 Generator com fallback (`apps/api/src/editorial/generator.ts`)

```ts
import { buildModelsChain } from '../agent/llm-fallback.ts';
import { buildEditorialPrompt, SYSTEM_PROMPT, type PromptArticle } from './prompt.ts';
import type { Editorial, EditorialSection } from '@genie/shared';
import type { Logger } from 'pino';

const TIMEOUT_MS = 60_000;
const RETRY_DELAYS = [2_000, 4_000, 8_000];

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

export async function generateEditorial(input: GenerateInput): Promise<GenerateOutput | null> {
  const { articles, periodLabel, apiKey, model, modelFallback, log } = input;
  if (articles.length === 0) {
    log.warn({ periodLabel }, 'editorial: no articles in period, skipping generation');
    return null;
  }

  const userPrompt = buildEditorialPrompt(articles, periodLabel);
  const chain = buildModelsChain(model, modelFallback) ?? [model];

  const attempts = Math.max(chain.length, 1 + RETRY_DELAYS.length);
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const primary = chain[attempt % chain.length]!;
    const fallbacks = chain.filter(m => m !== primary);
    const payload: Record<string, unknown> = {
      model: primary,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.4,
      stream: false,
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

      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        lastErr = new Error(`editorial: HTTP ${r.status}: ${txt.slice(0, 200)}`);
        log.warn({ attempt: attempt + 1, primary, status: r.status }, 'editorial: LLM error');
        if (r.status < 500 && r.status !== 429) break;
      } else {
        const data = (await r.json().catch(() => null)) as
          | { choices?: Array<{ message: { content: string } }>; model?: string; usage?: { total_tokens?: number } }
          | null;
        const raw = data?.choices?.[0]?.message?.content ?? '';
        const parsed = parseEditorialResponse(raw);
        if (parsed) {
          return {
            ...parsed,
            modelUsed: data?.model ?? primary,
            tokensUsed: data?.usage?.total_tokens ?? null,
          };
        }
        lastErr = new Error('editorial: invalid JSON in LLM response');
        log.warn({ attempt: attempt + 1, primary, rawPreview: raw.slice(0, 200) }, 'editorial: parse failed');
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      log.warn({ attempt: attempt + 1, primary, err: lastErr.message }, 'editorial: fetch error');
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts - 1 && attempt < RETRY_DELAYS.length) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]!));
    }
  }

  log.error({ err: lastErr?.message }, 'editorial: all attempts failed');
  return null;  // ← caller NÃO insere; UI cai em edição anterior
}

function parseEditorialResponse(raw: string): {
  leadTitle: string;
  leadBody: string;
  sections: EditorialSection[];
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.leadTitle !== 'string' || typeof obj.leadBody !== 'string') return null;
    if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;
    const sections: EditorialSection[] = obj.sections
      .filter((s: any) => s && typeof s.title === 'string' && typeof s.body === 'string')
      .map((s: any) => ({
        category: s.category,
        title: s.title.slice(0, 100),
        body: s.body,
        highlightTickers: Array.isArray(s.highlightTickers) ? s.highlightTickers.slice(0, 5) : [],
        sourceArticleIds: Array.isArray(s.sourceArticleIds) ? s.sourceArticleIds.filter((n: any) => Number.isInteger(n)) : [],
      }));
    if (sections.length === 0) return null;
    return { leadTitle: obj.leadTitle.slice(0, 120), leadBody: obj.leadBody, sections };
  } catch {
    return null;
  }
}
```

### 5.5 Job (`apps/api/src/jobs/editorial_refresh.ts`)

```ts
import type { DB } from '../store/db.ts';
import type { Logger } from 'pino';
import { generateEditorial } from '../editorial/generator.ts';
import { saveEditorial } from '../editorial/store.ts';
import { fetchArticlesInWindow } from '../editorial/store.ts';
import { config } from '../lib/config.ts';

const PERIOD_HOURS_BY_SLOT: Record<string, number> = {
  '08': 12,  // edição matinal cobre overnight + véspera
  '12': 4,
  '16': 4,
  '20': 4,
};

export class EditorialRefreshJob {
  constructor(private db: DB, private log: Logger) {}

  async run(_signal: AbortSignal): Promise<void> {
    const slot = currentSlot();
    if (!slot) {
      this.log.debug('editorial: not at scheduled slot, skipping');
      return;
    }
    const hours = PERIOD_HOURS_BY_SLOT[slot]!;
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - hours * 3600_000);

    const articles = fetchArticlesInWindow(this.db, periodStart, periodEnd);
    this.log.info({ slot, count: articles.length, hours }, 'editorial: starting generation');

    const result = await generateEditorial({
      articles,
      periodLabel: `${slot}h BRT — últimas ${hours}h`,
      apiKey: config.openrouterApiKey,
      model: config.openrouterModel,
      modelFallback: config.openrouterModelFallback,
      log: this.log,
    });

    if (!result) {
      this.log.warn({ slot }, 'editorial: generation failed, leaving previous edition in place');
      return;
    }

    const editionDate = formatBrtDate(periodEnd);
    saveEditorial(this.db, {
      slot, editionDate,
      periodStart, periodEnd,
      ...result,
      articleIds: collectArticleIds(result.sections),
    });
    this.log.info({ slot, editionDate, model: result.modelUsed }, 'editorial: saved');
  }
}

function currentSlot(): '08' | '12' | '16' | '20' | null {
  const brtHour = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
  }).format(new Date()));
  if (brtHour === 8) return '08';
  if (brtHour === 12) return '12';
  if (brtHour === 16) return '16';
  if (brtHour === 20) return '20';
  return null;
}

function formatBrtDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);  // 'YYYY-MM-DD'
}

function collectArticleIds(sections: { sourceArticleIds: number[] }[]): number[] {
  const ids = new Set<number>();
  sections.forEach(s => s.sourceArticleIds.forEach(id => ids.add(id)));
  return [...ids];
}
```

### 5.6 Registrar job (`apps/api/src/jobs/registrar.ts`)

```ts
// adicionar imports
import { EditorialRefreshJob } from './editorial_refresh.ts';

// adicionar constante (cron dispara nas 4 horas exatas BRT)
// BRT é UTC-3 sem DST → 8 BRT = 11 UTC, 12 BRT = 15 UTC, 16 BRT = 19 UTC, 20 BRT = 23 UTC
const EDITORIAL_SPEC = '0 11,15,19,23 * * *';

// dentro de registerJobs()
const editorial = new EditorialRefreshJob(deps.db, deps.log);
sched.schedule(deps.editorialSpec ?? EDITORIAL_SPEC, 'editorial-refresh', s => editorial.run(s));
```

> ⚠️ **Atenção fuso:** o servidor pode estar em UTC. Cron usa fuso do servidor por padrão. Definimos cron em UTC explicitamente (não BRT). Se o Croner aceitar `timezone` option, prefira passar `'America/Sao_Paulo'` e usar `'0 8,12,16,20 * * *'`. Verificar `scheduler.ts` antes de implementar.

### 5.7 Endpoint (`apps/api/src/server/routes/editorials.ts`)

```ts
import type { FastifyInstance } from 'fastify';
import type { EditorialService } from '../../editorial/service.ts';

export function registerEditorialRoutes(app: FastifyInstance, svc: EditorialService): void {
  app.get('/api/editorials', async (req, reply) => {
    const limit = Math.min(Number((req.query as any)?.limit) || 14, 30);
    const list = svc.listSummaries(limit);
    reply.header('Cache-Control', 'public, max-age=60');
    return list;
  });

  app.get('/api/editorials/latest', async (_req, reply) => {
    const editorial = svc.latest();
    if (!editorial) return reply.code(404).send({ error: 'no editorial available' });
    reply.header('Cache-Control', 'public, max-age=60');
    return editorial;
  });

  app.get<{ Params: { id: string } }>('/api/editorials/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    const editorial = svc.byId(id);
    if (!editorial) return reply.code(404).send({ error: 'not found' });
    reply.header('Cache-Control', 'public, max-age=300');
    return editorial;
  });
}
```

### 5.8 Sidebar (`apps/web/src/lib/components/layout/Sidebar.svelte`)

```svelte
<!-- adicionar item entre Favoritos e Rankings -->
<a href="/editorial" class="sidebar-item" class:active={$page.url.pathname.startsWith('/editorial')}>
  <Newspaper size={18} />
  <span>Editorial</span>
</a>
```

### 5.9 Estrutura visual da página `/editorial`

```
┌─────────────────────────────────────────────────────────────┐
│ EDIÇÃO 16:00 · 24 abr 2026          próxima edição em 47min │  ← EditorialHeader
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Petróleo recua e arrasta energia; varejo reage ao IPCA    │  ← EditorialLead
│  ───────────────────────────────────────────────            │     (lead title h1 32px)
│  O período foi marcado por uma queda de 2,1% no Brent...    │     (lead body 16px)
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────┐ ┌────────────────────────┐     │  ← EditorialSection cards
│  │ ⛽ ENERGIA SOB PRESSÃO │ │ 🛒 VAREJO RECUPERA    │     │     grid 2 cols (lg)
│  │ ────────────────────── │ │ ─────────────────────  │     │     1 col (sm)
│  │ Texto investigativo... │ │ Texto investigativo... │     │
│  │ ──                     │ │ ──                     │     │
│  │ • Manchete fonte 1     │ │ • Manchete fonte 1     │     │
│  │ • Manchete fonte 2     │ │ • Manchete fonte 2     │     │
│  │ [PETR4] [PRIO3]        │ │ [MGLU3] [LREN3]        │     │
│  └────────────────────────┘ └────────────────────────┘     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  EDIÇÕES ANTERIORES                                         │  ← EditorialArchive
│  ─────────────────────                                      │     (sticky right ou rodapé)
│  • 12:00 · 24 abr · "Bovespa busca direção..."             │
│  • 08:00 · 24 abr · "Abertura: olhos no Fed..."            │
│  • 20:00 · 23 abr · "Fechamento: Ibovespa em alta..."      │
└─────────────────────────────────────────────────────────────┘
```

Padrões visuais (CLAUDE.md princípio 5):
- Lead: gradiente sutil de fundo + borda accent laranja `#F97316` no top
- Section cards: `rounded-xl`, sombra em camadas, hover scale `1.02`, accent bar 2px com cor da categoria
- Tickers: badges douradas (mesmo padrão de ArticleCard)
- Tipografia: lead title 32px tracking-tight, section titles 20px, body 15px leading-relaxed
- Animação entrada: `animate-in fade-in slide-in-from-bottom-2`

---

## 6. Dependências entre passos (ordem de implementação)

1. **Types compartilhados** (`packages/shared/src/types.ts`) — base para todo o resto
2. **Migration** (`006_news_editorials.sql`) — schema antes de qualquer código que toque o DB
3. **Store** (`editorial/store.ts` + `fetchArticlesInWindow`) — camada de persistência
4. **Prompt + Generator** (`editorial/prompt.ts` + `generator.ts`) — lógica IA isolada (testável sem job)
5. **Service** (`editorial/service.ts`) — fachada pública
6. **Job + Registrar** — agendamento
7. **Endpoint REST** (`server/routes/editorials.ts`)
8. **Wiring `main.ts`** — instanciação e injeção
9. **Tests backend** (unit + integration) — validação antes de tocar frontend
10. **Client API frontend** (`apps/web/src/lib/api/editorial.ts`)
11. **Componentes Svelte** (Header, Lead, Section, Archive)
12. **Página + loader** (`routes/editorial/+page.svelte` + `+page.ts`)
13. **Página de edição arquivada** (`routes/editorial/[id]/`)
14. **Sidebar** — último, depois que página existe
15. **Build + smoke test E2E manual**
16. **CHANGELOG.md** — antes do commit

**Regra:** cada bloco compila isoladamente e tem teste verde antes de avançar.

---

## 7. Como testar

### 7.1 Unit tests (backend)

```bash
pnpm --filter api test editorial
```

Cobrir:
- `parseEditorialResponse`: JSON válido, JSON com markdown ao redor, JSON malformado, sections vazio
- `buildEditorialPrompt`: agrupa por categoria corretamente, trunca a 12 notícias/categoria
- `saveEditorial`: insere, respeita UNIQUE(date, slot), upsert se quiser permitir regeração manual
- `fetchArticlesInWindow`: filtra por `fetched_at` no range certo
- `EditorialRefreshJob.run`: skip quando articles=0, skip quando generator retorna null, insert quando ok (mockar fetch)

### 7.2 Teste de geração manual

```bash
# disparar job ad-hoc via REPL ou endpoint dev
curl -X POST http://localhost:3000/api/dev/jobs/editorial-refresh
# (criar endpoint dev-only protegido por NODE_ENV !== 'production')
```

Validar:
- Linha aparece em `news_editorials` com `status='ok'`
- `sections_json` parseável e contém 3-7 seções
- `model_used` populado
- Logs estruturados com `slot`, `editionDate`, `model`

### 7.3 Teste de resiliência

- Setar `OPENROUTER_API_KEY=invalid` → job deve falhar, **NÃO** inserir, log warn, edição anterior continuar disponível em `GET /api/editorials/latest`
- Apagar todas as edições do dia → `GET /api/editorials/latest` retorna a mais recente de qualquer dia anterior (ordenar por `generated_at DESC`)
- Sem nenhuma edição em todo o DB → 404 com mensagem amigável (UI mostra empty state)

### 7.4 Smoke test UI

1. `pnpm dev` em api e web
2. Disparar job manualmente (ou esperar slot)
3. Acessar `/editorial`:
   - Header mostra hora correta + countdown próxima edição
   - Lead aparece em destaque
   - 3-7 cards de seção renderizam
   - Cliques em manchetes-fonte abrem URL externa
   - Tickers em destaque clicáveis (link para `/asset/:ticker`)
   - Sidebar de arquivo lista últimas edições
   - Clique em arquivada navega para `/editorial/:id`
4. Resize: layout responde (2 cols → 1 col em mobile)
5. Sem edição: empty state amigável

### 7.5 Build

```bash
pnpm build         # api + web
pnpm test          # tudo verde
pnpm typecheck     # sem erros
```

---

## 8. Key details / armadilhas

### Fuso horário
- Croner pode ou não suportar `timezone` option. **Verificar** `apps/api/src/jobs/scheduler.ts` antes. Se não suportar, usar cron em UTC: `'0 11,15,19,23 * * *'` (8/12/16/20 BRT = 11/15/19/23 UTC, BRT é fixo UTC-3 sem horário de verão desde 2019).
- `formatBrtDate` usa Intl.DateTimeFormat com `timeZone: 'America/Sao_Paulo'` para garantir que `editionDate` é a data BRT (não UTC), evitando que edição das 20h apareça no dia errado para usuários brasileiros.

### Custo / rate limit
- 4 chamadas/dia × ~2000 tokens output × claude-3.5-haiku ≈ **negligível** (~$0.01/dia)
- Sem necessidade de circuit-breaker neste volume — o `buildModelsChain` já dá fallback automático

### Idempotência
- `UNIQUE(edition_date, slot)` previne duplicação se job rodar 2x no mesmo slot (ex: restart durante execução)
- `saveEditorial` deve usar `INSERT OR REPLACE` ou `INSERT ... ON CONFLICT DO UPDATE` para permitir regeração manual via endpoint admin futuro

### Article IDs órfãos
- Se uma notícia for deletada após referenciada em edição, o ID em `sourceArticleIds` vira órfão. Aceitar — UI faz `LEFT JOIN` e simplesmente não exibe a manchete morta. Não criar FK formal (custo de manutenção > benefício).

### Validação de `sourceArticleIds`
- LLM pode alucinar IDs. No `parseEditorialResponse`, filtrar IDs que não existem em `news_articles` (ou validar no service ao montar resposta). Mais seguro: validar no service (1 query SELECT WHERE id IN (...)).

### Variáveis de ambiente
- Reusar `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MODEL_FALLBACK` existentes
- Não introduzir novas env vars

### Imports que vou precisar
- Backend: `import { buildModelsChain } from '../agent/llm-fallback.ts';`
- Backend: `import { config } from '../lib/config.ts';`
- Frontend: `import { Newspaper } from 'lucide-svelte';`

### Tabela de migrations
- Confirmar próximo número antes de criar (006 é palpite — checar `apps/api/src/store/migrations/` para próximo livre)

### Window de notícias para 1ª edição (08h)
- Cobre 12h (overnight + véspera tarde) porque entre 20h da véspera e 08h é onde acontece notícia internacional relevante (Wall Street, Ásia)

### Não-quebrar features existentes
- Nenhuma alteração em `news_articles`, `news_refresh.ts`, `news/service.ts` — só leitura via novo `fetchArticlesInWindow`
- Sidebar mexida só adiciona item, não remove nem reordena os outros

---

## 9. Critérios de aceite

- [ ] `pnpm build` passa sem warnings
- [ ] `pnpm test` verde (incluindo novos tests)
- [ ] Cron registrado e disparando nos 4 slots BRT corretos (verificável via log)
- [ ] Falha de LLM **não** corrompe estado: edição anterior segue acessível
- [ ] Página `/editorial` carrega edição mais recente em < 500ms (cache HTTP 60s)
- [ ] Layout responsivo (mobile + desktop)
- [ ] Item "Editorial" aparece no Sidebar entre Favoritos e Rankings
- [ ] Empty state amigável quando ainda não há nenhuma edição
- [ ] CHANGELOG.md atualizado com entrada da fase
- [ ] Sem secrets vazados em logs (apenas modelo, contagem, status)

---

## 10. Estimativa

- Backend (types → service → job → endpoint → tests): **~3-4h**
- Frontend (componentes + página + sidebar): **~2-3h**
- Polish + smoke + CHANGELOG: **~1h**
- **Total: 6-8h** — viável em uma SubFase única dado o escopo bem isolado.
