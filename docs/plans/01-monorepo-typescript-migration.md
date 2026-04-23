# Plano: Migração do Genie para Monorepo 100% TypeScript

> Status atual: monorepo pnpm com `apps/web` (SvelteKit + TS) e `packages/shared` (TS) já em TS, mas `apps/api` em Go (~7.465 LOC produção, ~50 arquivos + 44 de teste). O objetivo é reescrever o backend em TypeScript, mantendo paridade funcional, e unificar a stack.

---

## 1. Objetivo

Transformar o Genie num monorepo TypeScript puro, substituindo o backend Go (`apps/api`) por um equivalente em TS/Node com a mesma API HTTP, mesmos jobs agendados, mesmos tools de agente e mesmo schema SQLite — sem quebra para o frontend.

**Motivações:**
- Uma única linguagem reduz fricção (types compartilhados de verdade via `@genie/shared`, sem duplicar structs).
- Ecosistema npm (OpenAI SDK, scrapers, libs de LLM) é mais rico para esta classe de app.
- Onboarding e manutenção simplificados.

**Não-objetivos:**
- Trocar SQLite, trocar arquitetura de agente, trocar frontend.
- Introduzir novos features durante a migração (feature freeze no backend).

---

## 2. Stack-alvo do novo backend

| Camada | Escolha | Justificativa |
|---|---|---|
| Runtime | **Node 22 LTS** | Estável, `--watch` nativo, suporte nativo a TS em breve; usar `tsx` hoje |
| Framework HTTP | **Fastify 5** | Rápido, schema validation nativa, plugin system, ergonomia boa com TS |
| Router / middleware | Fastify plugins | substitui `go-chi` (rotas, cors, middlewares) |
| DB driver | **better-sqlite3** | síncrono, rápido, embutido (substitui `modernc.org/sqlite`) |
| Query/migrations | **Drizzle ORM** + `drizzle-kit` | Type-safe, migrations SQL-first (compatível com as existentes), sem gerar código feio |
| Scheduler | **croner** | API simples, TS-first (substitui `robfig/cron`) |
| Logger | **pino** | Estruturado, rápido, ecosistema maduro (substitui `zerolog`) |
| LLM client | **openai** (SDK oficial) apontando para OpenRouter | mantém compatibilidade com `openrouter` atual |
| HTTP client | **undici** (nativo do Node) | fetch nativo, sem dependência extra |
| HTML parsing / scraping | **cheerio** + **@mozilla/readability** + **jsdom** | substitui `goquery` + `go-readability` |
| HTML→Markdown | **turndown** | substitui `JohannesKaufmann/html-to-markdown` |
| Validação | **zod** | runtime + tipos; usado em bodies, query params, tool args |
| Testes | **vitest** | já usado no `web`; unifica DX |
| Config | **dotenv** + zod schema | valida env no boot, falha cedo |
| Build | **tsup** | bundle único para produção (ESM, minify, sourcemaps) |
| Dev runner | **tsx watch** | hot reload sem build |

**Runtime alternativo considerado:** Bun. Rejeitado por ora — `better-sqlite3` e alguns plugins Fastify ainda têm arestas no Bun, e o ganho não justifica o risco numa migração já grande. Fica como opção pós-migração.

---

## 3. Mapa de equivalências Go → TS

Mapeamento módulo a módulo do que existe hoje em `apps/api/internal/` para o novo `apps/api/src/`:

| Módulo Go (atual) | Módulo TS (novo) | Notas |
|---|---|---|
| `cmd/genie/main.go` | `src/main.ts` | bootstrap: config → db → migrations → scheduler → server |
| `cmd/genie/embed.go` | `src/static.ts` | serve build do `apps/web` (Fastify `@fastify/static`) |
| `internal/lib/config` | `src/lib/config.ts` | zod schema do env |
| `internal/lib/logger` | `src/lib/logger.ts` | pino wrapper com contextos (`whatsapp`, `git`, etc. — aqui: `b3`, `agent`, `news`, `job`) |
| `internal/lib/metrics` | `src/lib/metrics.ts` | counters/histograms em memória (ou `prom-client` se já expõe) |
| `internal/store/db.go` | `src/store/db.ts` | abre SQLite, aplica migrations |
| `internal/store/migrations/*.sql` | `src/store/migrations/*.sql` | **reaproveitar verbatim** via drizzle-kit |
| `internal/store/conversations.go` | `src/store/conversations.ts` | CRUD de mensagens/conversas |
| `internal/store/favorites.go` | `src/store/favorites.ts` | CRUD de favoritos |
| `internal/store/news.go` | `src/store/news.ts` | CRUD de artigos |
| `internal/server/server.go` | `src/server/app.ts` | Fastify instance + plugin registration |
| `internal/server/middleware.go` | `src/server/middleware.ts` | rate limit, logger, error handler |
| `internal/server/*_handler.go` | `src/server/routes/*.ts` | 1 arquivo por domínio (chat, b3, news, favorites, metrics, static) |
| `internal/server/static_handler.go` | `src/server/routes/static.ts` | serve SPA + fallback |
| `internal/agent/loop.go` | `src/agent/loop.ts` | loop de tool-calling |
| `internal/agent/message.go` | `src/agent/message.ts` | tipos (já no `@genie/shared`) |
| `internal/agent/prompt.go` | `src/agent/prompt.ts` | system prompt |
| `internal/agent/tool.go` | `src/agent/tool.ts` | interface Tool + dispatcher |
| `internal/agent/openrouter/*` | `src/agent/openrouter.ts` | SDK `openai` com `baseURL` do OpenRouter |
| `internal/tools/*.go` | `src/tools/*.ts` | 1 arquivo por tool, todas implementam `Tool` |
| `internal/tools/registry_builder.go` | `src/tools/registry.ts` | monta lista de tools habilitadas |
| `internal/b3/*.go` | `src/b3/*.ts` | cada source (brapi, yfinance, googlefinance, investidor10, statusinvest) vira 1 arquivo |
| `internal/b3/breaker.go` | `src/b3/breaker.ts` | circuit breaker (pode usar `opossum` ou implementação caseira — preferir caseira, simples) |
| `internal/b3/cache.go` | `src/b3/cache.ts` | cache em memória com TTL |
| `internal/b3/cascade.go` | `src/b3/cascade.ts` | fallback entre sources |
| `internal/news/*.go` | `src/news/*.ts` | service + cache |
| `internal/jobs/*.go` | `src/jobs/*.ts` | scheduler + registrar + jobs individuais |

**Princípio:** mesma arquitetura, mesmos nomes de módulo, mesmos limites. Migração é reescrita 1:1, não redesenho.

---

## 4. Estrutura final do monorepo

```
genie/
├─ apps/
│  ├─ api/                       # reescrito em TS
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ drizzle.config.ts
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ static.ts
│  │  │  ├─ lib/
│  │  │  ├─ store/
│  │  │  │  ├─ migrations/      # .sql reaproveitados
│  │  │  │  └─ schema.ts        # Drizzle schema
│  │  │  ├─ server/
│  │  │  │  ├─ app.ts
│  │  │  │  ├─ middleware.ts
│  │  │  │  └─ routes/
│  │  │  ├─ agent/
│  │  │  ├─ tools/
│  │  │  ├─ b3/
│  │  │  ├─ news/
│  │  │  └─ jobs/
│  │  └─ tests/                  # integration + unit (vitest)
│  └─ web/                       # inalterado
├─ packages/
│  ├─ shared/                    # expandido com mais tipos compartilhados
│  └─ (futuro: packages/tools-sdk se valer extrair)
├─ package.json                  # scripts unificados, sem `api:*` com `go`
├─ pnpm-workspace.yaml
└─ tsconfig.base.json            # novo — compartilhado por api/web/shared
```

**Removidos:** `go.work`, `go.work.sum`, `apps/api/go.mod`, `apps/api/go.sum`, `Makefile` (substituído por scripts pnpm), todos os `*.go`, `*.exe`, `cover*.out`.

---

## 5. Fases da migração

Divisão em SubFases seguindo o princípio de "build passa no fim de cada uma" e "features críticas têm paridade verificável".

### Fase 1A — Scaffolding do novo backend (2-3h)

**Objetivo:** criar `apps/api-ts` em paralelo ao `apps/api` (Go), sem remover nada. Stack funcionando com um endpoint de health.

**Arquivos:**
- `apps/api-ts/package.json` — deps: fastify, better-sqlite3, drizzle-orm, drizzle-kit, pino, zod, openai, undici (builtin), cheerio, @mozilla/readability, jsdom, turndown, croner, dotenv. Dev: typescript, tsx, tsup, vitest, @types/node, @types/better-sqlite3.
- `apps/api-ts/tsconfig.json` extends `tsconfig.base.json`
- `apps/api-ts/src/main.ts` — Fastify mínimo, escutando em 5858
- `apps/api-ts/src/lib/config.ts` — zod schema do env
- `apps/api-ts/src/lib/logger.ts` — pino com child loggers
- `tsconfig.base.json` na raiz
- `package.json` raiz — adicionar `api-ts:dev`, `api-ts:build`, `api-ts:test`

**Verificação:** `pnpm --filter @genie/api-ts dev` sobe em :5858, `GET /health` retorna `{ok:true}`.

### Fase 1B — Store + migrations (2-3h)

**Arquivos:**
- `apps/api-ts/drizzle.config.ts`
- `apps/api-ts/src/store/migrations/` ← copiar `001_init.sql` e `002_news_articles.sql` verbatim
- `apps/api-ts/src/store/schema.ts` — Drizzle schema refletindo as tabelas
- `apps/api-ts/src/store/db.ts` — abre DB, aplica migrations pendentes no boot (usar `drizzle-orm/better-sqlite3/migrator` ou runner caseiro que lê os `.sql`)
- `apps/api-ts/src/store/conversations.ts` — funções `createMessage`, `listByConversation`, etc.
- `apps/api-ts/src/store/favorites.ts`
- `apps/api-ts/src/store/news.ts`
- Testes: `tests/store/*.test.ts` com DB in-memory

**Verificação:** rodar migrations contra uma cópia do `genie.db` atual — schema bate, queries retornam os mesmos dados.

### Fase 1C — B3 sources (4-6h)

Maior risco de divergência — cada source é scraping/API externa. Testar contra fixtures existentes em `apps/api/internal/b3/testdata/`.

**Arquivos:**
- `apps/api-ts/src/b3/types.ts`
- `apps/api-ts/src/b3/http.ts` — cliente HTTP com timeout
- `apps/api-ts/src/b3/cache.ts` — TTL cache
- `apps/api-ts/src/b3/breaker.ts` — circuit breaker (open/half-open/closed)
- `apps/api-ts/src/b3/source.ts` — interface `Source`
- `apps/api-ts/src/b3/brapi.ts`
- `apps/api-ts/src/b3/yfinance.ts`
- `apps/api-ts/src/b3/googlefinance.ts`
- `apps/api-ts/src/b3/investidor10.ts`
- `apps/api-ts/src/b3/statusinvest_scraper.ts`
- `apps/api-ts/src/b3/cascade.ts` — fallback
- `apps/api-ts/src/b3/categories.ts`
- Copiar `testdata/` para `apps/api-ts/tests/b3/fixtures/`

**Key details:**
- Scraping em Go usa `goquery` (seletores jQuery-like) → `cheerio` tem API praticamente idêntica.
- `readability` → `@mozilla/readability` + `jsdom`.
- Respeitar os mesmos timeouts (5s local, 30-60s remoto).

**Verificação:** testes de cada source passam com as mesmas fixtures; cascade retorna o mesmo resultado para tickers de referência (PETR4, VALE3, ITUB4).

### Fase 1D — News service (2h)

**Arquivos:**
- `apps/api-ts/src/news/types.ts`
- `apps/api-ts/src/news/cache.ts`
- `apps/api-ts/src/news/service.ts`

### Fase 1E — Agent + tools (4-5h)

**Arquivos:**
- `apps/api-ts/src/agent/openrouter.ts` — wrapper do SDK `openai`
- `apps/api-ts/src/agent/prompt.ts`
- `apps/api-ts/src/agent/tool.ts` — interface + dispatcher
- `apps/api-ts/src/agent/message.ts` — reuso dos tipos de `@genie/shared`
- `apps/api-ts/src/agent/loop.ts` — loop de tool-calling com streaming SSE
- `apps/api-ts/src/tools/types.ts`
- `apps/api-ts/src/tools/b3_quote.ts`
- `apps/api-ts/src/tools/b3_fundamentals.ts`
- `apps/api-ts/src/tools/b3_search_ticker.ts`
- `apps/api-ts/src/tools/favorites.ts`
- `apps/api-ts/src/tools/web_fetch.ts`
- `apps/api-ts/src/tools/web_search.ts`
- `apps/api-ts/src/tools/registry.ts`

**Key details:**
- Manter o mesmo formato de `StreamEvent` do `@genie/shared` para não quebrar o frontend.
- `openai` SDK com `baseURL: 'https://openrouter.ai/api/v1'` e header `Authorization`.
- `web_fetch` usa `undici` + `@mozilla/readability` + `turndown`.
- Validar args de tool com zod schemas (gerar o JSON schema exposto ao LLM a partir do zod via `zod-to-json-schema`).

### Fase 1F — HTTP server + rotas (3-4h)

**Arquivos:**
- `apps/api-ts/src/server/app.ts` — Fastify + CORS + rate limit + logger hook
- `apps/api-ts/src/server/middleware.ts`
- `apps/api-ts/src/server/routes/chat.ts` — POST `/api/chat` (SSE)
- `apps/api-ts/src/server/routes/b3.ts` — GET `/api/quote/:ticker`, `/api/fundamentals/:ticker`, etc.
- `apps/api-ts/src/server/routes/news.ts`
- `apps/api-ts/src/server/routes/favorites.ts`
- `apps/api-ts/src/server/routes/metrics.ts`
- `apps/api-ts/src/server/routes/static.ts` — `@fastify/static` servindo `apps/web/build` com fallback SPA
- `apps/api-ts/src/static.ts` — resolve path do build em dev vs prod

**Verificação:** cada endpoint responde com o mesmo contract do Go (comparar via `curl` side-by-side enquanto o Go roda em :5859 e o TS em :5858).

### Fase 1G — Jobs (2h)

**Arquivos:**
- `apps/api-ts/src/jobs/scheduler.ts` — croner
- `apps/api-ts/src/jobs/registrar.ts`
- `apps/api-ts/src/jobs/daily_favorites.ts`
- `apps/api-ts/src/jobs/news_refresh.ts`

### Fase 1H — Integração E2E + paridade (3-4h)

- Subir o backend TS, apontar `apps/web` para ele (já aponta via proxy para :5858; basta desligar o Go e subir o TS).
- Rodar fluxos golden-path: chat + tool call, listar favoritos, adicionar favorito, ver news, ver cotação.
- Rodar o frontend e validar que nada quebra.
- `pnpm build` em todo o monorepo deve passar.

### Fase 1I — Cutover e limpeza (1-2h)

Só executar quando 1H estiver 100% verde:

- Renomear `apps/api` → `apps/api-go-legacy` (mantido numa branch por segurança).
- Renomear `apps/api-ts` → `apps/api`.
- Remover `go.work`, `go.work.sum`, `Makefile` (ou reescrever Makefile como pnpm scripts).
- Atualizar `package.json` raiz: substituir scripts `api:dev` (Go) por o novo `api:dev` (tsx).
- Remover binários `genie.exe`, `*.out`, `genie-err.log`.
- Atualizar `README.md` e `docs/ARCHITECTURE.md`.
- `.gitignore`: tirar regras Go, adicionar `dist/`, `*.db-*`.
- Commit do cutover numa única PR bem grande, revertível como bloco.

---

## 6. Testes — paridade como critério de aceite

**Estratégia:** cada módulo novo tem seu arquivo de teste correspondente, rodando as mesmas asserções lógicas que o teste Go fazia. Não traduzir teste por teste mecanicamente — traduzir o **comportamento** testado.

**Fixtures reaproveitadas:**
- `apps/api/internal/b3/testdata/*.html` → `apps/api-ts/tests/b3/fixtures/`
- `apps/api/internal/tools/testdata/*` → `apps/api-ts/tests/tools/fixtures/`

**Pyramid alvo:**
- Unit (70%): cada source, cache, breaker, cada tool, cada store fn, cada service.
- Integration (20%): rotas Fastify com DB real (in-memory), agent loop com LLM mockado.
- E2E (10%): script que sobe o servidor, faz chat + tool call + favoritos, valida respostas.

**Gate de merge:** `pnpm -r test` passa, cobertura ≥ 60% geral, ≥ 80% em `agent/`, `b3/`, `store/`.

---

## 7. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Divergência sutil em scraping (cheerio vs goquery) | Alta | Médio | Fixtures compartilhadas + testes de paridade byte-a-byte no parsing |
| Performance menor que Go (latência SSE, concorrência) | Média | Médio | Fastify + better-sqlite3 são rápidos; benchmark o chat/quote antes do cutover |
| SQLite lock em writes concorrentes (WAL mode) | Baixa | Médio | Habilitar WAL no boot (`pragma journal_mode = WAL`), igual ao Go |
| OpenRouter SSE diferente no SDK openai | Média | Alto | Testar early na Fase 1E; fallback para fetch+parser manual se necessário |
| Jobs duplicados rodando durante cutover | Baixa | Alto | Cutover é atômico: desligar Go antes de ligar TS |
| Migrations incompatíveis (tipos SQLite) | Baixa | Alto | Reaproveitar `.sql` verbatim — mesmo schema, mesmo banco |
| Build Windows (better-sqlite3 precisa build tools) | Média | Baixo | Documentar no README; usar `better-sqlite3` prebuilt binaries (padrão) |

---

## 8. Estimativa

- Fase 1A: 2-3h
- Fase 1B: 2-3h
- Fase 1C: 4-6h
- Fase 1D: 2h
- Fase 1E: 4-5h
- Fase 1F: 3-4h
- Fase 1G: 2h
- Fase 1H: 3-4h
- Fase 1I: 1-2h

**Total:** 23-31h de trabalho focado. Realista em ~1 semana calendar se for contínuo, 2-3 semanas com outras obrigações.

---

## 9. Critérios de conclusão

1. `apps/api` é 100% TypeScript, zero arquivo `.go` no repo.
2. `pnpm build` na raiz compila tudo sem erros/warnings.
3. `pnpm test` passa em todos os packages com cobertura no gate definido.
4. Todos os endpoints respondem com o mesmo contract (request → response shape) do backend Go.
5. Frontend funciona sem nenhuma modificação.
6. Jobs agendados disparam nos mesmos horários e têm o mesmo efeito observável no DB.
7. `CHANGELOG.md` atualizado com entrada major (2.0.0) documentando o cutover.
8. `README.md` e `docs/ARCHITECTURE.md` refletem a nova stack.

---

## 10. O que fica para depois (fora de escopo)

- Avaliar Bun como runtime.
- Extrair `src/tools/` para `packages/tools` se outro serviço vier a consumi-las.
- Trocar SQLite por Postgres (se escalar exigir).
- Observability real (OTel + Grafana) — hoje só logs + contadores em memória.
