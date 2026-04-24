# Changelog

All notable changes to Genie are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.1.0] - 2026-04-24

### Fase 15: Por dentro das notícias (editorial financeiro com IA)

#### Resumo

Nova página `/editorial` com um boletim financeiro brasileiro investigativo, gerado automaticamente quatro vezes ao dia (08h, 12h, 16h e 20h BRT) a partir das notícias coletadas pela rotina horária. Cada edição traz um lead síntese, seções investigativas por categoria com fontes citadas, tickers em destaque e um arquivo navegável das edições anteriores. Resiliência: se a geração de uma edição falhar, a edição anterior permanece acessível — a UI sempre exibe a última edição válida.

#### Plano de design

`docs/plans/por-dentro-das-noticias.md` — escopo, decisões de arquitetura, snippets-chave e armadilhas (fuso BRT, validação de IDs alucinados pelo LLM, idempotência por `UNIQUE(edition_date, slot)`).

#### Backend (`apps/api/src/`)

**Novos arquivos**

- **`store/migrations/004_news_editorials.sql`** — tabela `news_editorials` (id, slot, edition_date, period_start/end, lead_title/body, sections_json, article_ids_json, model_used, tokens_used, generated_at) com `UNIQUE(edition_date, slot)`
- **`editorial/types.ts`** — `EditorialSlot`, `EditorialSection`, `Editorial`, `EditorialSummary`, `EditorialArticleRef` (locais ao módulo, sincronizados com `@genie/shared`)
- **`editorial/store.ts`** — `saveEditorial` (upsert), `getLatestEditorial`, `getEditorialById`, `listEditorialSummaries`, `fetchArticlesInWindow`, `fetchArticlesByIds`
- **`editorial/prompt.ts`** — `SYSTEM_PROMPT` editorial-chefe + `buildEditorialPrompt` (agrupa por categoria, max 12 manchetes/categoria, especifica formato JSON)
- **`editorial/generator.ts`** — `generateEditorial` (chamada única OpenRouter com `buildModelsChain` para fallback), `parseEditorialResponse` (extrai JSON de markdown wrapper, valida categorias, filtra IDs órfãos, normaliza tickers maiúsculos)
- **`editorial/service.ts`** — `EditorialService` (latest, byId, listSummaries) com enriquecimento automático de `sourceArticles` por meio de single-query lookup
- **`jobs/editorial_refresh.ts`** — `EditorialRefreshJob` com janela dinâmica por slot (manhã cobre 12h overnight, demais cobrem 4h), `runForSlot()` para disparo manual, formatação de `editionDate` em fuso BRT
- **`server/routes/editorials.ts`** — `GET /api/editorials` (lista paginada), `GET /api/editorials/latest`, `GET /api/editorials/:id` (cache HTTP 60-300s)

**Arquivos modificados**

- **`store/db.ts`** — adicionada `004_news_editorials.sql` à lista de migrations
- **`jobs/scheduler.ts`** — `schedule()` aceita opção `{ timezone }` (backward-compatible) para que o cron BRT seja interpretado no fuso correto independente do servidor
- **`jobs/registrar.ts`** — registra `editorial-refresh` com `EDITORIAL_SPEC = '0 8,12,16,20 * * *'` em `America/Sao_Paulo`
- **`server/app.ts`** — `AppDeps` aceita `editorialSvc` e `editorialJob`; rota registrada
- **`server/routes/admin.ts`** — `POST /api/admin/jobs/editorial/run` com body `{ slot }` para disparo manual de qualquer slot (08/12/16/20)
- **`main.ts`** — instancia `EditorialService` e `EditorialRefreshJob` no boot e injeta no app

#### Frontend (`apps/web/src/`)

**Novos arquivos**

- **`lib/components/editorial/EditorialHeader.svelte`** — cabeçalho da edição (slot label + data formatada + horário BRT + countdown próxima edição); modo `isLive=false` para edições arquivadas
- **`lib/components/editorial/EditorialLead.svelte`** — bloco lead em destaque (gradiente lilac sutil, accent bar, tipografia display 32px)
- **`lib/components/editorial/EditorialSection.svelte`** — card por categoria com emoji, título, body investigativo, badges douradas para tickers (com link `/asset/:ticker`), lista de fontes citadas (clica e abre URL externa); cor da accent bar varia por categoria
- **`lib/components/editorial/EditorialArchive.svelte`** — sidebar sticky com até 14 edições anteriores; destaca edição atual via `currentId`
- **`routes/editorial/+page.ts`** + **`+page.svelte`** — loader SSR via `Promise.allSettled` (latest + archive em paralelo); empty state amigável quando 404; layout grid 2 cols + aside 320px
- **`routes/editorial/[id]/+page.ts`** + **`+page.svelte`** — edição arquivada com `error(404)` se id inválido/inexistente; link "voltar à edição atual"

**Arquivos modificados**

- **`lib/api/client.ts`** — métodos `getLatestEditorial`, `getEditorial(id)`, `listEditorials(limit)`
- **`lib/components/layout/Sidebar.svelte`** — item "Editorial" (ícone `Newspaper`) entre Favoritos e Rankings; lógica `isActive` agora usa `startsWith` para destacar a aba quando estamos em `/editorial/:id`

#### Tests

- **`apps/api/tests/editorial/generator.test.ts`** — 9 casos cobrindo parser (input vazio, JSON malformado, sem leadTitle, categorias inválidas, IDs órfãos, markdown wrapper, caps de tamanho)
- **`apps/api/tests/editorial/store.test.ts`** — 7 casos cobrindo round-trip, upsert por `(edition_date, slot)`, ordenação `DESC, id DESC`, fetch em janela e por IDs

Total: 249 unit tests passando (api) + 437 testes passando (web).

#### Resiliência

- Falha total do LLM (apertar 3 retries em todos os modelos da chain) → job loga error e **não insere** linha; UI continua exibindo última edição válida via `getLatestEditorial`
- Janela vazia (zero artigos no período) → job loga warn e pula geração
- LLM alucina `sourceArticleIds` inexistentes → filtro descarta antes do save (única lookup-set construído a partir dos `articles` enviados ao prompt)
- Custo estimado: ~$0.01/dia (4 chamadas × ~2k tokens em `claude-3.5-haiku`)

#### Bootstrap automático

- `main.ts` foi estendido para garantir que `/`, `/predicoes` e `/editorial` sempre tenham conteúdo no primeiro acesso após um deploy/DB novo:
  - `news_articles` vazio → `NewsRefreshJob` executa em background (5s após boot)
  - `news_editorials` vazio → após o news terminar, gera editorial para o **último slot BRT já passado** (`lastPassedSlot()` em `jobs/editorial_refresh.ts`): às 09h escolhe `'08'`, às 13h escolhe `'12'`, antes das 08h escolhe `'20'` da véspera
  - Encadeamento via `await`: se ambas tabelas estão vazias, news roda primeiro (popula a janela) e o editorial só dispara depois — evita gerar editorial sobre janela vazia
  - Falhas no bootstrap são logadas mas não derrubam o servidor

#### Como testar

```bash
# disparo manual (admin token necessário)
curl -X POST http://localhost:5858/api/admin/jobs/editorial/run \
  -H 'X-Admin-Token: ...' -H 'Content-Type: application/json' \
  -d '{"slot": "16"}'

# verificar
curl http://localhost:5858/api/editorials/latest
```

UI: acesse `/editorial`. Empty state aparece se nenhuma edição existe ainda; o cron começa a popular a partir do próximo slot BRT.

---

## [2.0.0] - 2026-04-22

### Fase 14: Migração do backend Go para TypeScript (monorepo 100% TS)

#### Resumo

Reescrita completa do backend de Go para TypeScript/Node, mantendo paridade funcional total com o backend anterior. A stack agora é 100% TypeScript — sem compiladores adicionais, tipos realmente compartilhados via `@genie/shared`, e um único ecosistema de testes (Vitest).

#### Stack do novo backend (`apps/api`)

| Camada | Tecnologia |
|---|---|
| Runtime | Node 22 + tsx (dev) / tsup (prod) |
| HTTP | Fastify 5 + @fastify/cors + @fastify/rate-limit |
| DB | better-sqlite3 (síncrono, WAL mode) |
| Migrations | SQL verbatim reaproveitado do backend Go |
| ORM/schema | Drizzle ORM (schema declarativo) |
| Logger | pino com child loggers por contexto |
| Scheduler | croner |
| LLM | openai SDK apontando para OpenRouter |
| Scraping | cheerio + @mozilla/readability + turndown |
| Config | dotenv + zod (falha no boot se inválida) |
| Testes | Vitest, 207 testes, 22 arquivos |

#### Arquivos criados (`apps/api/src/`)

- **`lib/config.ts`** — zod schema do env; `getConfig()` singleton com validação no boot
- **`lib/logger.ts`** — pino com suporte a pino-pretty em dev
- **`store/db.ts`** — `openDB`, `migrate`, `openAndMigrate`; WAL + FK + busy_timeout
- **`store/schema.ts`** — Drizzle schema (favorites, news_cache, conversations, messages, news_articles)
- **`store/conversations.ts`** — `createConversation`, `appendMessage`, `getMessages`, `listConversations`
- **`store/favorites.ts`** — `addFavorite`, `removeFavorite`, `listFavorites`, `isFavorite`, `updateLastNewsAt`
- **`store/news.ts`** — `upsertArticles`, `listByTicker`, `listByCategory`, `listRecent`, `pruneArticles`
- **`store/migrations/001_init.sql`** — reaproveitado verbatim do Go
- **`store/migrations/002_news_articles.sql`** — reaproveitado verbatim do Go
- **`b3/types.ts`** — `B3Error` com code discriminado; helpers `isTickerNotFound` etc.
- **`b3/source.ts`** — interface `Source` + `validateTicker`
- **`b3/http.ts`** — `fetchWithTimeout`, `buildHeaders`, constantes de timeout
- **`b3/cache.ts`** — `TTLCache<T>` com cleanup via setInterval unref'd
- **`b3/breaker.ts`** — `CircuitBreaker` com `Clock` injetável para testes determinísticos
- **`b3/cascade.ts`** — `Cascade` com TTL cache por tipo (5min quotes, 24h fundamentals) + `Semaphore` para warmup paralelo
- **`b3/categories.ts`** — mapa 1:1 do Go; reverse index O(1); `searchTickers`, `categoryOf`, `allTickers`
- **`b3/brapi.ts`** — `BrapiSource` (brapi.dev API)
- **`b3/yfinance.ts`** — `YFinanceSource` (Yahoo Finance v7/v10, sufixo `.SA`)
- **`b3/statusinvest.ts`** — `StatusInvestScraper` (cheerio, parsing PT-BR: `parseBrazilianFloat`)
- **`news/service.ts`** — `NewsService` com L1 cache → DB freshnessCheck → web search; `byCategory`, `byTicker`, `refreshTickers`, `refreshCategory`
- **`agent/message.ts`** — `Message`, `ToolCallRequest`, `Role`
- **`agent/prompt.ts`** — `SYSTEM_PROMPT`, `buildMessages` com context hint opcional
- **`agent/tool.ts`** — `Tool`, `Registry` (register/get/list/schemas)
- **`agent/openrouter.ts`** — `OpenRouterClient` com streaming SSE + retry (1s/2s/4s backoff)
- **`agent/loop.ts`** — `QueryLoop`: loop de tool-calling, parallel tools via `Semaphore`, SSE emitter, persistência de histórico
- **`tools/b3_quote.ts`** — tool `b3_quote` (concurrent)
- **`tools/b3_fundamentals.ts`** — tool `b3_fundamentals` (concurrent)
- **`tools/b3_search_ticker.ts`** — tool `b3_search_ticker` (prefix search estático)
- **`tools/favorites.ts`** — tools `favorite_add`, `favorite_remove`, `favorite_list`
- **`tools/web_search.ts`** — `WebSearch` (DuckDuckGo HTML scraping via cheerio) + `asTool()`; implementa `NewsSearcher`
- **`tools/web_fetch.ts`** — `WebFetch` (readability + turndown + sanitização de prompt injection + SSRF guard) + `asTool()`
- **`server/app.ts`** — `buildApp(deps)` Fastify com CORS, rate-limit, logger hook, error handler
- **`server/routes/b3.ts`** — GET `/api/b3/quote/:ticker`, `/api/b3/fundamentals/:ticker`, `/api/b3/search`, `/api/b3/categories`
- **`server/routes/news.ts`** — GET `/api/news?category=&ticker=&limit=`
- **`server/routes/favorites.ts`** — GET/POST/DELETE `/api/favorites`; GET `?enrich=true` busca quote + news concorrentemente
- **`server/routes/chat.ts`** — POST `/api/chat/stream` SSE; cria/resolve conversationId; persiste histórico
- **`jobs/scheduler.ts`** — `Scheduler` (croner, single-flight guard, 5min timeout por job, panic recovery via try/catch)
- **`jobs/daily_favorites.ts`** — `DailyFavoritesJob` (refresh news dos favoritos + stamp `last_news_at`)
- **`jobs/news_refresh.ts`** — `NewsRefreshJob` (refresh categorias + favoritos + warmup cache de quotes)
- **`jobs/registrar.ts`** — `registerJobs` (wiring scheduler + jobs com specs padrão)
- **`main.ts`** — bootstrap completo: config → DB → B3 cascade → registry → LLM → news → scheduler → Fastify; shutdown gracioso

#### Testes criados (`apps/api/tests/`)

207 testes em 22 arquivos de teste cobrindo todas as camadas:
- store: 46 testes (db, conversations, favorites, news)
- b3: 78 testes (source, cache, breaker, categories, brapi, yfinance, statusinvest, cascade)
- news: 9 testes (service com searcher mock)
- agent: 13 testes (prompt, tool/registry, loop com LLM mock)
- tools: 17 testes (b3_quote, b3_fundamentals, b3_search_ticker, favorites)
- server: 15 testes (endpoints via Fastify inject)
- jobs: 6 testes (scheduler, daily_favorites)
- e2e: 23 testes de paridade (todos os endpoints com app real em memória)

#### Breaking changes

- `apps/api` agora é TypeScript/Node — não existe mais `go run`, `go test`, `go build`
- `go.work` e `go.work.sum` tornados obsoletos (mantidos na raiz para referência histórica)
- Scripts `go:dev`, `go:test`, `go:cover` removidos do `package.json` raiz
- Backend Go preservado em `apps/api-go-legacy/` para rollback se necessário

---

## [0.18.0] - 2026-04-17

### Fase 13: Observabilidade + preenchimento de lacunas de cobertura

#### Fase 13: Métricas in-memory, middleware de tracing, endpoint /api/metrics, gap filling

##### Added

- **`apps/api/internal/lib/metrics/metrics.go`** — registry de métricas in-memory sem dependência externa. Tipos: `Counter` (atomic int64), `Timer` (ring buffer de 1000 observações, p50/p95/p99/max em ms), `Gauge` (float64 thread-safe). Chave canônica `name{k=v,...}` com labels ordenados alfabeticamente. `Registry.Snapshot()` retorna cópia profunda serializável em JSON.
- **`apps/api/internal/lib/metrics/metrics_test.go`** — 17 testes cobrindo thread-safety, percentis corretos, ring buffer overflow, label ordering, snapshot consistency.
- **`apps/api/internal/server/middleware.go`** — três middlewares exportados:
  - `RequestID()`: lê `X-Request-ID` ou gera 8-byte hex; injeta no ctx e resposta.
  - `RequestLogger(log, reg)`: log estruturado por request; incrementa `http_requests_total{method,status}` e timer `http_request_duration{method,route}` quando registry não-nil.
  - `Recoverer(log)`: captura panics, loga stack com `request_id`, retorna 500.
- **`apps/api/internal/server/middleware_test.go`** — 18 testes para os três middlewares (geração de ID, preservação de ID existente, contadores por status class, chi route pattern, panic recovery).
- **`apps/api/internal/server/metrics_handler.go`** — `WithMetrics(*metrics.Registry)` chainable; `GET /api/metrics` → JSON snapshot. Auth via `X-Admin-Token` quando `AdminToken` configurado; sem token → público.
- **`apps/api/internal/server/metrics_handler_test.go`** — 7 testes: snapshot correto, 404 sem registry, auth 200/401, campos obrigatórios.
- **`apps/api/internal/server/admin_test.go`** — gap filling: `WithDailyJob`, `adminAuthMiddleware` (todas as branches), `handleAdminRunDailyFavorites` 503/202, `b3ErrorToHTTP` caminhos `ErrSourceUnavailable` e erro genérico, caminhos de erro 500 em favorites (list/add/remove).
- **`apps/api/internal/store/store_gaps_test.go`** — 20 testes de error paths após DB close para todos os repos (conversations, favorites, news). Cobre `Open` com path inválido, `CreateConversation`/`AppendMessage`/`GetMessages`/`ListConversations` closed, todas as operações de favorites e news. Adiciona testes para `PublishedAt`, `FetchedAt` zero, paginação além do fim.
- **`apps/api/internal/agent/openrouter/client_gaps_test.go`** — 10 testes: `NewClient`, `parseNonStream` sem choices / JSON inválido / content não-string, SSE chunk malformado skipado, contexto cancelado durante retry delay, todos retries esgotados, `httpError.Error()` com status na mensagem.

##### Changed

- **`apps/api/internal/server/server.go`** — campo `metrics *metrics.Registry` adicionado à struct `Server`; import de `internal/lib/metrics`; rota `GET /api/metrics` registrada condicionalmente em `buildRouter`.
- **`docs/ARCHITECTURE.md`** — nova seção "Observability" documentando logger, middlewares, métricas in-memory (tabelas de tipos e métricas emitidas), endpoint `/api/metrics`, e guia de expansão para Prometheus/OpenTelemetry.

##### Coverage delta

| Package | Antes | Depois |
|---------|-------|--------|
| `internal/lib/metrics` | N/A (novo) | 92.7% |
| `internal/server` | 78.9% | 84.4% |
| `internal/store` | 78.0% | 89.8% |
| `internal/agent/openrouter` | 86.1% | 96.0% |
| **Total global** | **82.9%** | **85.8%** |

---

## [0.17.0] - 2026-04-17

### Fase 14: Packaging — single binary com frontend embed

#### Fase 14: Go embed + StaticHandler + Makefile + scripts cross-platform

##### Added

- **`apps/api/cmd/genie/embed.go`** (`//go:build embedweb`) — diretiva `//go:embed all:webdist` + `WebFS() (fs.FS, bool)` que expoe o subdiretorio webdist como fs.FS.
- **`apps/api/cmd/genie/embed_empty.go`** (`//go:build !embedweb`) — implementacao stub de `WebFS()` para modo dev/API-only (retorna `nil, false`). Sem este arquivo o build sem tag nao compila.
- **`apps/api/internal/server/static_handler.go`** — `StaticHandler` com:
  - Leitura eager de `index.html` no construtor (`NewStaticHandler`).
  - SPA fallback: qualquer path nao encontrado serve `index.html` (suporte a rotas client-side).
  - Cache-Control inteligente: `no-cache` para `index.html`, `max-age=31536000, immutable` para assets com hash (8+ hex chars), `max-age=300` para demais.
  - Content-Type override por extensao (`.js`, `.css`, `.svg`, `.woff2`, etc.).
  - Gzip on-the-fly para arquivos > 1 KB quando `Accept-Encoding: gzip` presente.
  - Protecao contra path traversal via `fs.ValidPath`.
  - Guard defensivo: paths `/api/*` retornam 404 imediatamente.
- **`apps/api/internal/server/static_handler_test.go`** — 9 testes unitarios com `testing/fstest.MapFS`:
  - `ServeIndex`, `ServeHashedCSS`, `ServeHashedJS`, `SPAFallback`, `APIPrefixReturns404`, `GzipHonored`, `PathTraversalBlocked`, `InvalidPathRejected`, `NoSPAFallback_WhenNilFS`, `NewStaticHandler_MissingIndexHTML`.
- **`Makefile`** (raiz) — targets: `dev`, `test`, `api-test`, `api-cover`, `build`, `build-web`, `build-api`, `build-linux`, `build-darwin`, `build-windows`, `release`, `clean`, `help`. Usa `-tags embedweb` e `-ldflags "-s -w -X main.version=..."`.
- **`scripts/build.sh`** — build completo Unix/macOS/WSL com relatorio de tamanho. Suporte a `--no-frontend` e variaveis `GOOS`/`GOARCH`/`OUTPUT`.
- **`scripts/build.ps1`** — equivalente PowerShell 7 com parametro `-NoFrontend`. Exibe tamanho final em MB.
- **`docs/DEPLOY.md`** — guia completo: requisitos, build, variaveis de ambiente, exemplo systemd, Nginx reverse proxy, cross-compile, upgrade, dev mode.

##### Changed

- **`apps/api/internal/server/server.go`**:
  - Campo `staticFS fs.FS` adicionado ao struct `Server`.
  - Campo `metrics *metrics.Registry` adicionado ao struct `Server` (necessario para `metrics_handler.go` da Fase 13).
  - Import `io/fs` e `github.com/joaopedro/genie/api/internal/lib/metrics` adicionados.
  - `buildRouter()` agora registra `r.NotFound(sh.ServeHTTP)` quando `staticFS != nil`; em API-only mode o comportamento padrao (404) e mantido.
  - Metodo `WithStatic(fsys fs.FS) *Server` adicionado (chainable).
- **`apps/api/cmd/genie/main.go`** — apos `.WithFavorites(...)`, detecta `WebFS()` e chama `srv.WithStatic(wfs)` quando o frontend esta embutido. Loga modo de operacao em ambos os casos.
- **`.gitignore`** — adicionados: `apps/api/cmd/genie/webdist/`, `/genie`, `/genie.exe`, `/genie-*`.
- **`README.md`** — secao "Comandos" expandida com `make build`, `make test`, `make release` e deploy em 3 linhas.

##### Technical details

- Build tag `embedweb` seleciona entre `embed.go` (com frontend) e `embed_empty.go` (stub). Em `go run ./cmd/genie` (sem tag) a API serve apenas `/api/*` e `/health`.
- `webdist/` e gerado pelos scripts de build e **nao deve ser commitado**.
- Cross-compile funciona sem CGO porque `modernc.org/sqlite` e pure Go.
- Tamanho esperado do binario: ~30-50 MB (frontend embutido + SQLite Pure Go + runtime Go).

## [0.16.0] - 2026-04-17

### Fase 12A: Favoritos — UI + Store + Endpoints REST

#### Fase 12A: Backend handler com enriquecimento + store Svelte + componentes de UI

##### Added

- **`apps/api/internal/server/favorites_handler.go`** — Handler HTTP completo para favoritos:
  - Interface `NewsRepository`: `ListByTicker(ctx, ticker, limit) ([]store.Article, error)`
  - Struct `FavoriteEnriched` com `Quote *b3.Quote`, `NewsCount int`, `LatestNews *store.Article`
  - `WithFavorites(repo FavoritesRepository, quoteSrc B3Source, newsRepo NewsRepository) *Server` — builder chainable com 3 dependências injetáveis
  - `handleListFavorites`: suporte a `?enrich=true` com `sync.WaitGroup` aninhado (goroutine por ticker, quote + news em paralelo)
  - `handleAddFavorite`: chama `IsFavorite` antes; retorna 200 se já existe, 201 se novo (idempotência)
  - `handleRemoveFavorite`: retorna 204 No Content (sem body)
  - Degradação graciosa: falha no b3 mantém `Quote = nil`; resposta retorna 200 com dados parciais

- **`apps/api/internal/server/favorites_handler_test.go`** — 15 testes de integração (cobertura 78.9%):
  - Lista vazia, lista com items, sem repo → 503, erro de DB → 500
  - Enriquecimento com quote + news, falha b3 → quote null
  - POST 201 (novo), POST 200 (idempotente), ticker lowercase normalizado
  - POST 400 ticker inválido, POST 400 JSON malformado
  - DELETE 204 (existente e não-existente), DELETE 400 ticker inválido, sem repo → 503

- **`apps/web/src/lib/stores/favorites.ts`** — Store Svelte reescrita com Set-based tickers, cache TTL 30s, updates otimistas, factory pattern `createFavoritesActions`

- **`apps/web/src/lib/stores/favorites.test.ts`** — 25 testes unitários cobrindo load, has, toggle, add, remove

- **`apps/web/src/lib/components/favorites/FavoriteButton.svelte`** — Botão de favoritar reutilizável (sizes sm/md, aria-pressed, spinner durante toggle)

- **`apps/web/src/lib/components/favorites/FavoriteButton.test.ts`** — 10 testes de renderização e interação

- **`apps/web/src/lib/components/favorites/FavoriteRow.svelte`** — Linha da lista: avatar, badge de notícias novas, preço BRL, botões de ação com eventos `remove` e `navigate`

- **`apps/web/src/lib/components/favorites/FavoriteRow.test.ts`** — 11 testes de renderização, badge e eventos

- **`apps/web/src/routes/favorites/+page.ts`** — SSR load chamando `getFavorites(true)` com fallback vazio

- **`apps/web/src/routes/favorites/+page.svelte`** — Página com header gradient, skeleton loading, empty state, lista de favoritos, footer de refresh e toast

##### Changed

- **`apps/api/internal/server/server.go`** — Campos `b3FavSrc B3Source` e `newsRepo NewsRepository` adicionados à struct
- **`apps/api/cmd/genie/main.go`** — `favServerAdapter` + wiring `.WithFavorites(adapter, b3Cascade, newsRepo)`
- **`packages/shared/src/types.ts`** — `FavoriteEnriched extends Favorite` com `quote?`, `newsCount`, `latestNews?`
- **`apps/web/src/lib/api/client.ts`** — Overloads TypeScript `getFavorites(enrich?)` + `triggerDailyRefresh()`
- **`apps/web/src/lib/components/asset/AssetHeader.svelte`** — Corrigido `.includes()` → `.has()` para `Set<string>`

##### Technical Details

- Concurrent enrichment com `sync.WaitGroup` aninhado (quote + news em paralelo por ticker)
- Idempotent REST: POST 201/200, DELETE 204 sempre
- O(1) Set lookup para tickers favoritos; updates otimistas com rollback
- Coverage: backend 78.9% (meta 75%), frontend 99.65% statements (meta 70%)
- 422 testes frontend passando; 15 testes Go handler passando; `pnpm build` clean

---

## [0.15.1] - 2026-04-17

#### Fase 11: Página de Ativo (`/asset/[ticker]`)

##### Added

- **`apps/api/internal/server/b3_handler.go`** — `B3Source` interface + `WithB3(src)` builder. Handlers: `GET /api/b3/quote/{ticker}`, `GET /api/b3/fundamentals/{ticker}`, `GET /api/b3/search?q=X`, `GET /api/b3/categories`. `b3ErrorToHTTP()` maps sentinel errors → 400/404/503.
- **`apps/api/internal/server/b3_handler_test.go`** — Tests for all 4 B3 endpoints: mock `B3Source`, Quote OK/400/404/503/no-src, Fundamentals OK/400/404/503/no-src, Search valid/empty-q/no-match, Categories.
- **`apps/web/src/lib/utils/asset.ts`** — `statusInvestURL()`, `changeColor()`, `formatChangePct()` pure utilities.
- **`apps/web/src/lib/utils/asset.test.ts`** — 13 unit tests covering all utilities with null/undefined/zero edge cases.
- **`apps/web/src/routes/asset/[ticker]/+page.ts`** — `PageLoad` with parallel `Promise.all([getQuote, getNewsByTicker])`. Maps 400/404 → `error(404)`, 503 → `error(503)`, else → `error(500)`.
- **`apps/web/src/routes/asset/[ticker]/+page.svelte`** — 4-tab layout (Resumo/Fundamentos/Notícias/Chat). Lazy fundamentals load on tab open. `<svelte:head><title>{ticker} — Genie</title></svelte:head>`. Loads favorites on mount.
- **`apps/web/src/lib/components/asset/AssetHeader.svelte`** — Ticker + name, price 48px font-technical, changePct color-coded, meta (volume/marketCap/source). Favorite button with `aria-pressed` + Star icon (lucide-svelte).
- **`apps/web/src/lib/components/asset/AssetTabs.svelte`** — `role="tablist"`, `role="tab"`, `aria-selected` strings. Arrow-key navigation. `AssetTab` type exported from `<script context="module">`.
- **`apps/web/src/lib/components/asset/AssetSummary.svelte`** — Quote source + Status Invest link, up to 3 latest news, empty state, dispatches `viewNews`.
- **`apps/web/src/lib/components/asset/AssetFundamentals.svelte`** — P/L, P/VP, DY, ROE, Dívida/Patrim, Margem Líq. Null → "—". Skeleton rows + `.fundamentals__info-cell`.
- **`apps/web/src/lib/components/asset/AssetNews.svelte`** — Articles sorted by `publishedAt` desc. Empty state (Newspaper icon). Links `_blank` + `rel="noopener noreferrer"`. `.news__title` class.
- **`apps/web/src/lib/components/asset/AssetChat.svelte`** — Reuses `chatStore`/`chatActions`/`Message`/`ChatInput`/`OrbMini`. Injects `contextData`. `aria-live="polite"`.
- **`apps/web/src/lib/components/asset/AssetTabs.test.ts`** — 5 tests.
- **`apps/web/src/lib/components/asset/AssetFundamentals.test.ts`** — 6 tests.
- **`apps/web/src/lib/components/asset/AssetNews.test.ts`** — 6 tests.
- **`apps/web/src/lib/components/asset/AssetSummary.test.ts`** — 5 tests.
- **`apps/web/src/lib/components/asset/AssetHeader.test.ts`** — 9 tests (vi.hoisted for mock isolation).
- **`apps/web/src/lib/components/asset/AssetChat.test.ts`** — 5 tests.

##### Changed

- **`apps/api/internal/server/server.go`** — Added `b3Src`, `favRepo`, `b3FavSrc`, `newsRepo` fields. Registered B3 + favorites routes in `buildRouter()`.
- **`apps/api/cmd/genie/main.go`** — B3 cascade construction. `favServerAdapter` bridges `store.Favorite` → `server.FavoriteRecord`. Server chain `.WithB3(b3Cascade).WithFavorites(...)`.
- **`apps/web/src/lib/api/client.ts`** — Added `getQuote()`, `getFundamentals()`, `searchTickers()`, overloaded `getFavorites(enrich?)`, `addFavorite()`, `removeFavorite()`, `triggerDailyRefresh()`. 204 handling.

##### Technical details

- Backend `server` package coverage: 78.9% (target ≥75%).
- Frontend: 436 tests, 37 files, all passing. `svelte-check` — 0 errors, 0 warnings.
- `AssetTab` in `<script context="module">` — required for TypeScript import across files.
- `aria-selected` uses string `"true"/"false"` for correct DOM attribute serialization.

---

## [0.15.0] - 2026-04-17

### Fase 10: Home page — chat aberto + news grid por categoria

#### Fase 10A: Grid de notícias por categoria

##### Added

- **`apps/web/src/lib/utils/time.ts`** — `formatRelativeTime(iso, now?)`: retorna strings como "agora mesmo", "há 3min", "há 2h", "há 5d", "9 abr" (usa getUTCDate para evitar timezone drift).
- **`apps/web/src/lib/utils/time.test.ts`** — 15 testes unitários com datas fixas cobrindo todos os intervalos (segundos, minutos, horas, dias, >7d), incluindo todos os 12 meses em pt-BR.
- **`apps/web/src/lib/utils/format.ts`** — `formatCurrency(n)`, `formatPct(n, decimals)`, `formatNumber(n)` usando `Intl.NumberFormat` pt-BR.
- **`apps/web/src/lib/utils/format.test.ts`** — 13 testes unitários cobrindo valores positivos, negativos, zero, grandes.
- **`apps/web/src/lib/utils/markdown.ts`** — `renderInlineMarkdown(text)`: escape HTML → bold/italic/code/link via regex → parágrafos. XSS-safe: escapa `<`, `>`, `&`, `"` antes de aplicar markdown. Links com scheme não-http→`href="#"`.
- **`apps/web/src/lib/utils/markdown.test.ts`** — 14 testes incluindo XSS (`<script>`), bold, italic, code, links, múltiplos parágrafos, `\n` → `<br>`.
- **`apps/web/src/lib/components/home/CategoryTabs.svelte`** — Pills de categoria horizontais scrolláveis. Props: `categories`, `active` (bindable). Labels em pt-BR. Emite `change`. Active: border/text gold com glow.
- **`apps/web/src/lib/components/home/CategoryTabs.test.ts`** — 9 testes: render, labels pt-BR, active class, aria-selected, change event, click atualiza.
- **`apps/web/src/lib/components/home/ArticleCard.svelte`** — Card de notícia: título (2 linhas clamp), fonte+tempo relativo, snippet (3 linhas), badges gold de tickers. Role=button, tabindex=0, Enter/Space abre URL em nova aba. Hover lift + gradient border.
- **`apps/web/src/lib/components/home/ArticleCard.test.ts`** — 12 testes: render, relative time, click/keyboard abre URL, tickers, ausência de campos opcionais.
- **`apps/web/src/lib/components/home/NewsGrid.svelte`** — Grid responsivo (1/2/3 col) por categoria. Fetch via `ApiClient` injetável. Estados: loading (6 skeleton cards), success, empty (ícone Newspaper), error (msg + retry). Cache in-memory por categoria para evitar re-fetch.
- **`apps/web/src/lib/components/home/NewsGrid.test.ts`** — 9 testes com ApiClient mockado: skeleton, sucesso, vazio, erro, retry, cache.
- **`apps/web/src/lib/components/home/HeroOrb.svelte`** — Seção hero: Orb (clamp 200-360px) + título gradient "Genie" + subtítulo. Aceita `orbState` reativo.
- **`apps/web/src/lib/components/home/HeroOrb.test.ts`** — 7 testes: render, h1, subtitle, aria-label, orbState.

#### Fase 10B: Chat aberto com mascote

##### Added

- **`apps/web/src/lib/components/chat/ToolCallCard.svelte`** — Card colapsável (`<details>`) de tool call. Header: ícone Wrench gold + nome + badge status + duração. Expandido: args JSON + resultado JSON. Running: pulsação suave + spinner.
- **`apps/web/src/lib/components/chat/ToolCallCard.test.ts`** — 12 testes: todos os estados (running/done/error), duração, JSON, classes, abertura padrão no erro.
- **`apps/web/src/lib/components/chat/Message.svelte`** — Mensagem de chat. User: alinhado direita, bg glass-lilac. Assistant: alinhado esquerda, OrbMini avatar. Conteúdo via `renderInlineMarkdown` + `{@html}`. Typing indicator animado ao streaming. Badge de erro. Tool calls com ToolCallCard.
- **`apps/web/src/lib/components/chat/Message.test.ts`** — 13 testes: user/assistant classes, markdown bold/link, XSS prevention, typing indicator, error badge, tool calls.
- **`apps/web/src/lib/components/chat/ChatInput.svelte`** — Textarea auto-grow (até 4 linhas) com submit. Enter envia, Shift+Enter quebra linha. Loading: input disabled + spinner. Emite `submit { message }`.
- **`apps/web/src/lib/components/chat/ChatInput.test.ts`** — 12 testes: render, Enter envia, Shift+Enter não envia, empty não envia, disabled, loading, limpa após submit.
- **`apps/web/src/lib/components/chat/ChatPanel.svelte`** — Painel completo: header (título + botão clear), lista de mensagens scrollável (auto-scroll), ChatInput. Props `mode: inline|overlay` e `compact`. Overlay: backdrop blur + close button. Actions injetáveis para testes.
- **`apps/web/src/lib/components/chat/ChatPanel.test.ts`** — 12 testes: render, empty state, mensagens do store, send, clear, streaming subtitle, modos inline/overlay/compact.
- **`apps/web/src/routes/+page.svelte`** — Home reescrita. Modo hero (sem conversa): HeroOrb + ChatInput centralizado. Modo conversa: OrbMini compacto + ChatPanel inline. Seção de notícias (sempre visível): CategoryTabs + NewsGrid. Transições Svelte fade/scale. Começa em `financeiro`.

##### Changed

- **`apps/web/src/routes/+page.svelte`** — Substituído placeholder por implementação completa dos modos hero/conversa + seção de notícias.

##### Technical Details

- Cobertura global `src/lib/`: **96.58%** (statements), mantida acima do alvo de 70%.
- 436 testes passando em 37 arquivos de teste.
- `pnpm build` passa sem erros.
- Nenhuma dependência nova adicionada (sem `marked`; renderização manual XSS-safe).
- `renderInlineMarkdown` escapa HTML antes de aplicar regex — nunca processa HTML raw do usuário.

---

## [0.13.0] - 2026-04-17

### Fase 8B: Frontend API client + chat store SSE

#### Fase 8B: API Client, SSE stream, chat store

##### Added

- **`packages/shared/src/types.ts`** — Expanded shared types: `Role`, updated `Message` (role + optional content/toolCalls/toolCallId/name), `ToolCallRequest`, `Fundamentals`, updated `Quote`/`Article` with optional fields, `Favorite`, `TokenUsage`, updated `StreamEvent` (fields aligned with Go backend: `toolCallId`, `toolName`, `toolArgs`, `toolResult`, `durationMs`, `usage?: TokenUsage`).
- **`apps/web/src/lib/api/client.ts`** — `ApiClient` class: `health()`, `config()`, `getNewsByCategory()`, `getNewsByTicker()`. 30s timeout via `AbortController`. `ApiError` with `status`, `message`, `body`. Default `apiClient` singleton.
- **`apps/web/src/lib/api/client.test.ts`** — 15 unit tests covering all methods, error handling (non-OK, timeout, non-JSON body), baseURL prepending, Accept headers.
- **`apps/web/src/lib/api/chat-stream.ts`** — `streamChat()` async generator: POST `/api/chat/stream`, Web Streams `ReadableStream` reader, `TextDecoder` with `{stream:true}`, SSE block parser (handles fragmented chunks, ignores `event:`/`id:`/`retry:` lines and `[DONE]` sentinel), yields `StreamEvent`, network errors yielded as `{type:'error'}`.
- **`apps/web/src/lib/api/chat-stream.test.ts`** — 16 unit tests: single chunk, fragmented chunks, non-OK response, network error, AbortSignal cancellation, request body propagation, SSE format robustness.
- **`apps/web/src/lib/stores/chat.ts`** — `chatStore` (Svelte `writable`), `ChatMessage`, `RenderedToolCall`, `ChatState`, `OrbState` types. `createChatActions(store, streamFn)` factory for DI. `chatActions` default export. Handles all 5 event types: `token` appends delta + orbState='speaking'; `tool_call_start` pushes RenderedToolCall; `tool_call_end` updates call; `message_end` marks complete + saves usage; `error` sets error + orbState='error' → resets to 'idle' after 400ms.
- **`apps/web/src/lib/stores/chat.test.ts`** — 25 unit tests covering full event sequence, orbState transitions, tool call lifecycle, usage persistence, clear(), setListening(), conversationId passthrough, error revert timer.
- **`apps/web/src/lib/api/index.ts`** — Barrel export for `ApiClient`, `ApiError`, `apiClient`, `streamChat` and all types.
- **`.env.example`** — Added `PUBLIC_API_BASE_URL=""` (empty = same origin).

##### Changed

- **`apps/web/svelte.config.js`** — Added `kit.alias['@genie/shared']` pointing to `../../packages/shared/src/types.ts` so all web source files can `import ... from '@genie/shared'`.
- **`apps/web/vite.config.ts`** — Cleaned up (removed manual resolve.alias; kit.alias handles resolution).

##### Technical details

- `streamChat` uses Web Streams `ReadableStream.getReader()` — supported natively in Node 20+ and all modern browsers; no polyfill needed.
- SSE buffer accumulates across chunks, splits on `\n\n`, parses `data:` lines only; all other SSE field types ignored for simplicity.
- `createChatActions` factory pattern enables pure unit tests without network calls — pass async generator mock as `streamFn`.
- `clear()` resets the bound `store`, not the module-level singleton, so tests using local stores work correctly.
- Coverage: `src/lib/api/` 98.13% statements, `src/lib/stores/chat.ts` 97.38% statements — both well above 75% target.
- 213 tests total, 16 test files, all passing.

---

## [0.12.1] - 2026-04-17

### Fase 12B: Job Diário de Atualização de Notícias dos Favoritos

#### Fase 12B: Scheduler + DailyFavoritesJob + Admin Endpoint

##### Added

- **`apps/api/internal/jobs/scheduler.go`** — Wrapper sobre `robfig/cron/v3`:
  - `NewScheduler(log, location)` — cria scheduler com timezone configurável
  - `Schedule(spec, name, job)` — registra job com cron spec; retorna erro se spec inválida
  - `Start()` / `Stop(ctx)` — lifecycle com graceful shutdown
  - `Entries()` — expõe jobs registrados para debug/introspection
  - Cada execução: `context.WithTimeout(bg, 5min)`, panic recovery com log, medição de duration
  - Single-flight guard por nome (skip com warn log se job já está rodando)

- **`apps/api/internal/jobs/scheduler_test.go`** — 6 testes cobrindo:
  - Schedule + Start + Stop cycle
  - Expressão cron inválida → erro
  - Duration registrada no log
  - Panic em job não derruba scheduler
  - Skip de execução concorrente do mesmo job

- **`apps/api/internal/jobs/daily_favorites.go`** — Job de refresh de notícias:
  - Interfaces `NewsRefresher` e `FavoritesLister` para dependency injection
  - Tipo local `Favorite{Ticker}` para evitar import cycle com `internal/store`
  - `NewDailyFavoritesJob(favs, news, log)` + `Run(ctx) error`
  - Lógica: ListFavorites → ExtractTickers → RefreshTickers → UpdateLastNewsAt por ticker
  - Erros individuais de update são logados mas não abortam o job
  - Context cancellation é respeitado no loop de updates

- **`apps/api/internal/jobs/daily_favorites_test.go`** — 6 testes TDD:
  - Sem favoritos → no-op, retorna nil
  - 3 favoritos → chama RefreshTickers e UpdateLastNewsAt para cada
  - Refresh falha → erro propagado, UpdateLastNewsAt não chamado
  - Contexto cancelado → aborta com context.Canceled
  - ListFavorites falha → erro propagado
  - UpdateLastNewsAt falha → continua (non-fatal)

- **`apps/api/internal/jobs/registrar.go`** — Ponto único de configuração de jobs:
  - `Deps{Favorites, News, Log, DailyCronSpec}` — agrupa dependências
  - `Register(s, d) error` — registra `"daily-favorites-news"` com spec default `"0 8 * * 1-5"`

- **`apps/api/internal/jobs/registrar_test.go`** — 3 testes:
  - Entries() contém o job após Register
  - Spec inválida propaga erro
  - Spec vazia usa default sem erro

##### Modified

- **`apps/api/internal/store/favorites.go`** — Novo método:
  - `UpdateLastNewsAt(ctx, ticker, t time.Time) error` — atualiza `last_news_at` para o ticker

- **`apps/api/internal/store/favorites_test.go`** — 2 novos testes:
  - `TestFavorites_UpdateLastNewsAt` — verifica persistência do timestamp
  - `TestFavorites_UpdateLastNewsAt_NonExistent_NoError` — no-op para ticker inexistente

- **`apps/api/internal/server/server.go`** — Integração do admin endpoint:
  - Interface `JobRunner` para trigger manual de jobs
  - Campo `dailyJob JobRunner` na struct `Server`
  - `WithDailyJob(j JobRunner) *Server` — builder chainable
  - `adminAuthMiddleware` — valida `X-Admin-Token` vs `cfg.AdminToken`
  - `handleAdminRunDailyFavorites` — `POST /api/admin/jobs/daily-favorites/run` → 202
  - Rota admin adicionada em `buildRouter()`

- **`apps/api/internal/lib/config/config.go`** — Campo novo:
  - `AdminToken string` — lido de `ADMIN_TOKEN` env var (opcional; vazio desabilita admin)

- **`apps/api/cmd/genie/main.go`** — Integração completa do scheduler:
  - Cria `Scheduler` com timezone BRT (`time.FixedZone("BRT", -3*3600)`)
  - `favoritesAdapter` — adapter local que converte `[]store.Favorite` → `[]jobs.Favorite`
  - `nopNewsRefresher` — stub temporário até Fase 7 ser conectado (loga warn, retorna 0)
  - `jobs.Register(sched, deps)` — registra `daily-favorites-news`
  - `sched.Start()` antes do HTTP server
  - `sched.Stop(ctx)` no graceful shutdown pós-`srv.Start()`
  - `srv.WithDailyJob(dailyJob)` — wira o job no admin endpoint

##### Dependencies

- **`github.com/robfig/cron/v3 v3.0.1`** — adicionado ao `go.mod`

##### Technical Details

- **Import cycle workaround**: `store/news.go` importa `internal/news` e `internal/news/service.go` importa `internal/store`, criando um ciclo pré-existente. A solução foi definir `jobs.Favorite` localmente no pacote `jobs` e criar um `favoritesAdapter` em `main.go` que converte `[]store.Favorite` → `[]jobs.Favorite`, eliminando a necessidade de `jobs` importar `store`.
- **Coverage**: `internal/jobs` atingiu 93.3% de cobertura (meta: 70%).
- **Testes**: `go test ./...` passa em todos os 11 pacotes.

---

## [0.7.0] - 2026-04-17

### Fase 7: Serviço de Notícias (scraper + cache 30min)

#### Fase 7: News Service — store, service, handler

##### Added

- **`apps/api/internal/store/migrations/002_news_articles.sql`** — migration idempotente:
  - `news_articles (id, url UNIQUE, title, source, summary, tickers_json TEXT, category, published_at, fetched_at)`
  - Índices: `idx_news_articles_fetched (fetched_at DESC)`, `idx_news_articles_category (category, fetched_at DESC)`
  - `news_cache` mantida para backward compat; novo código usa `news_articles`

- **`apps/api/internal/store/news.go`** — `store.Article` (struct canônica) + `NewsRepo`:
  - `Article` definida aqui para evitar import cycle (news ← store ← news)
  - `NewNewsRepo(db *DB) *NewsRepo`
  - `Upsert(ctx, []Article)` — INSERT ... ON CONFLICT(url) DO UPDATE; normaliza URL (lowercase + strip trailing slash)
  - `ListByTicker(ctx, ticker, limit)` — usa `json_each(tickers_json)` do SQLite para filtro eficiente
  - `ListByCategory(ctx, cat, limit)` — WHERE category = ?
  - `ListRecent(ctx, since, limit)` — WHERE fetched_at > ?
  - `Prune(ctx, olderThan)` — DELETE WHERE fetched_at < cutoff; retorna `int64` rows deleted
  - `scanArticles` helper com NULL-safe scan para source, summary, category, published_at

- **`apps/api/internal/store/news_test.go`** — 15 testes com DB in-memory:
  - Upsert single/multiple, idempotência, ON CONFLICT (update tickers+summary), normalização de URL
  - ListByTicker case-insensitive, múltiplos tickers por artigo, empty result
  - ListByCategory empty, ListRecent por janela de tempo, Prune (1 deletado), Prune (nada a deletar)
  - Upsert empty slice (no-op), limit respeitado, ID populado após insert
  - Verificação de schema `news_articles` via PRAGMA table_info

- **`apps/api/internal/news/types.go`** — `type Article = store.Article` (type alias para evitar ciclo)

- **`apps/api/internal/news/cache.go`** — `Cache` interface + `TTLCache` in-memory:
  - Idêntico ao `b3.TTLCache` mas em package local (evita dependência cruzada)
  - `NewTTLCache()`, `Get`, `Set`, `Delete`, `Stop`, goroutine de cleanup a cada 60s

- **`apps/api/internal/news/cache_test.go`** — 6 testes: set/get, miss, expiração, delete, overwrite, concurrent (50 goroutines)

- **`apps/api/internal/news/service.go`** — `news.Service`:
  - Interfaces locais `NewsSearcher` (satisfeita por `*tools.WebSearch`) e `NewsFetcher` (opcional)
  - `NewService(search, repo, log, opts...)` com opções funcionais `WithFetcher`, `WithCategoryTTL`, `WithTickerTTL`, `WithCache`
  - `ByCategory(ctx, cat, limit)` — cache-first (key `news:cat:{cat}`, TTL 30min); top 3 tickers da categoria; search + upsert + set cache
  - `ByTicker(ctx, ticker, limit)` — cache-first (key `news:ticker:{TICKER}`, TTL 15min); uppercase normalization; category enrichment via `b3.CategoryOf`
  - `RefreshTickers(ctx, tickers)` — batch refresh para cron (Fase 12B); erros por ticker não interrompem loop; retorna `(fetched int, err error)` com first non-nil error
  - `searchForTickers` — search para múltiplos tickers, dedup por URL normalizada
  - `searchForTickerSingle` — variant que propaga erros (usada por RefreshTickers)
  - `extractDomain(url)` — strip `www.` do hostname
  - `normalizeArticleURL`, `filterLimit` helpers

- **`apps/api/internal/news/service_test.go`** — 19 testes com mocks `mockSearcher`, `mockCache`, `mockSearcherFn`:
  - Cache hit/miss, search fail (graceful empty), empty ticker error, uppercase normalization de cache key
  - Dedup por URL, limit aplicado, ByCategory top 3 tickers, cache hit evita search
  - Unknown category retorna empty+0 calls, RefreshTickers invalida cache, ContinuesOnError
  - Source extraído, FetchedAt set, Tickers set, Category set em ByCategory
  - WithCategoryTTL/WithTickerTTL options, limit=0 usa default (20)

- **`apps/api/internal/server/news_handler.go`** — `GET /api/news`:
  - Interface exportada `NewsLister { ByCategory, ByTicker }` (satisfeita por `*news.Service`)
  - Params: `?category={cat}`, `?ticker={symbol}`, `?limit={n}` (default 20)
  - 400 se nenhum param fornecido; 400 se limit inválido (não-inteiro ou ≤ 0)
  - 503 se `newsSvc` nil; 500 em erro de ByCategory; 400 em erro de ByTicker
  - Retorna `[]news.Article` (JSON array, nunca null)

- **`apps/api/internal/server/news_handler_test.go`** — 13 testes com `mockNewsService`:
  - 503 sem service; 400 sem params; 200 por category; 200 por ticker
  - Content-Type JSON; empty array (nunca null); 500 em erro de category; 400 em erro de ticker
  - Limit param passado; limit inválido (abc, -1, 0) → 400; default limit 20; WithNews chainable

##### Changed

- **`apps/api/internal/store/db.go`** — `Migrate` aplica `002_news_articles.sql` além de `001_init.sql`:
  - Embed adicional `//go:embed migrations/002_news_articles.sql`
  - Loop sobre `[]string{initSQL, newsArticlesSQL}` com erro indexado

- **`apps/api/internal/server/server.go`** — servidor extendido sem quebrar testes existentes:
  - Campo `newsSvc NewsLister` adicionado ao struct `Server`
  - Método chainable `WithNews(svc NewsLister) *Server`
  - Rota `GET /api/news` registrada em `buildRouter`

##### Architecture decision

- `store.Article` é a struct canônica (definida em `store/news.go`)
- `news.Article` é type alias (`= store.Article`) para conveniência de callers
- Evita import cycle: `news` → `store` (ok), `store` não importa `news`
- `server.NewsLister` interface exportada permite mocks em testes externos

#### Coverage

| Pacote | Cobertura | Meta |
|--------|-----------|------|
| `internal/news` | **84.9%** | ≥75% ✅ |
| `internal/store` | **78.0%** | ≥75% ✅ |
| `internal/server` | **70.7%** | ≥70% ✅ |
| Total global | **83.2%** | ≥70% ✅ |

- 56 novos testes, todos PASS
- Testes existentes de server, store e outros pacotes: todos PASS
- `go build ./...` e `go vet ./...` — limpos

---

## [0.8.0] - 2026-04-17

### Fase 8A + 9: Shell + Layout + Mascote Orb

#### Fase 8A: Shell + Layout (Sidebar, Header, MainLayout)

##### Added

- **`apps/web/src/lib/stores/ui.ts`** — 3 Svelte writable stores:
  - `chatPanelOpen` (bool, default false) — controla visibilidade do painel de chat lateral
  - `sidebarCollapsed` (bool, default false) — controla colapso da sidebar
  - `activeRoute` (string, default '/') — rota ativa atual

- **`apps/web/src/lib/components/layout/Sidebar.svelte`** — sidebar de 240px com:
  - Props: `collapsed` (bool, default false)
  - Logo: mini Orb animado (48px) + texto "Genie" com gradient-brand via font Sora
  - Navegação com ícones Lucide (`Home`, `Star`, `Settings`) para `/`, `/favorites`, `/settings`
  - Active item destacado com border-left 3px gold + glass-lilac background
  - `aria-current="page"` no item ativo via `$page.url.pathname`
  - Footer com versão "v0.1.0" muted
  - Collapsed state reduz largura para 64px (esconde labels e versão)

- **`apps/web/src/lib/components/layout/Header.svelte`** — header sticky 56px com:
  - Props: `title` (string)
  - Slot `actions` à direita para botões contextuais
  - Fundo `--bg-elevated`, border-bottom sutil

- **`apps/web/src/lib/components/layout/MainLayout.svelte`** — grid layout principal:
  - `[sidebar auto] [main 1fr]`, terceira coluna 380px quando `chatPanelOpen`
  - Slot padrão para conteúdo principal, slot `chat` para painel lateral
  - Consome `chatPanelOpen` e `sidebarCollapsed` dos stores de UI
  - Usa `:has(.layout__chat)` para ajuste dinâmico de grid

- **`apps/web/src/lib/components/layout/index.ts`** — barrel exports: Sidebar, Header, MainLayout

- **`lucide-svelte@^1.0.1`** — adicionado como dependência de produção

##### Changed

- **`apps/web/src/routes/+layout.svelte`** — agora wraps tudo com `MainLayout` e importa o CSS global

- **`apps/web/src/routes/+page.svelte`** — home placeholder atualizado:
  - `<Orb state="idle" size={360} />` como hero central
  - Título "Genie" gradient-brand em `clamp(40px, 6vw, 64px)`
  - Subtítulo "Seu assistente financeiro da B3"
  - Chat input estilizado (ainda não funcional — Fase 8B)
  - Placeholder `<div class="news-grid">` para Fase 10A

##### Added (routes)

- **`apps/web/src/routes/favorites/+page.svelte`** — stub mínimo (`<h1>Favoritos</h1>`)
- **`apps/web/src/routes/settings/+page.svelte`** — stub mínimo (`<h1>Settings</h1>`)

##### Tests

- **`apps/web/src/lib/stores/ui.test.ts`** — 7 testes: valores iniciais, set/subscribe nos 3 stores
- **`apps/web/src/lib/components/layout/Sidebar.test.ts`** — 11 testes: render, 3 nav items (hrefs, labels), aria-current no ativo, sem aria-current nos inativos, versão, collapsed class, aria-label
- **`apps/web/src/lib/components/layout/Header.test.ts`** — 5 testes: render, título prop, sem h1 quando title vazio, role banner, slot de actions
- **`apps/web/src/lib/components/layout/MainLayout.test.ts`** — 7 testes: render, sidebar presente, main area, chat panel oculto por padrão, chat panel visível quando store=true, store toggle

#### Fase 9: Mascote Orb Animado

##### Added

- **`apps/web/src/lib/components/Orb.svelte`** — componente SVG + CSS animado (< 200 linhas):

  **Props:**
  - `state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'` (default: `'idle'`)
  - `size: number` (default: `240`) — controla CSS var `--size`
  - `tokensPerSec: number` (default: `0`) — intensifica pulse em `speaking` (0-30 tps → 0-1 intensity)

  **Camadas (de fora para dentro):**
  1. `.orb__glow-outer` — radial gradient violeta/branco com `filter: blur(12px)`, animação `breathe`
  2. `.orb__orbital` (SVG) — 4 elementos: círculo gold dashed, círculo interno branco, elipse horizontal gold, elipse vertical lilac; 3 partículas orbitando com `orbit-1/2/3` keyframes
  3. `.orb__core` — esfera 60%×60% com radial gradient branco→lilás→violeta, box-shadow orb-glow, animação `pulse`

  **Velocidades por estado:**
  | state | breathe | rotate | pulse |
  |-------|---------|--------|-------|
  | idle | 900ms | 18s | 900ms |
  | listening | 500ms | 12s | 500ms |
  | thinking | 600ms | 6s | 400ms |
  | speaking | 300ms | 8s | 250ms |
  | error | 900ms | 30s | 800ms |

  **State visual overrides:**
  - `error`: `hue-rotate(-40deg) saturate(1.4)` no core e glow → tint vermelho-rosado
  - `thinking`: box-shadow gold extra no core
  - `speaking`: box-shadow violeta mais intenso

  **Acessibilidade:**
  - `role="img"` com `aria-label` dinâmico por estado (PT-BR)
  - `@media (prefers-reduced-motion: reduce)` pausa todas as animações com `animation-duration: 0s; animation-play-state: paused`

  **Reatividade:**
  - `$:` recalcula `orbStyle` (CSS vars) quando `state`, `size` ou `tokensPerSec` mudam

- **`apps/web/src/lib/components/OrbMini.svelte`** — wrapper compacto `border-radius: 50%` wrapping `<Orb size={64} />`. Para uso como avatar/header.

##### Changed

- **`apps/web/src/routes/design-system/+page.svelte`** — adicionada seção "Mascote Orb":
  - 5 Orbs lado a lado (120px) mostrando cada estado com label abaixo
  - Controlador interativo: 5 botões para alternar estado do Orb demo (200px)
  - O label do estado ativo fica em gold/bold

##### Tests

- **`apps/web/src/lib/components/Orb.test.ts`** — 18 testes: render em cada state (5), role="img", aria-label por state (5), data-state attribute, camadas DOM (glow, orbital, core), tamanho default, prop `size` em CSS var
- **`apps/web/src/lib/components/OrbMini.test.ts`** — 5 testes: render, Orb interno presente, 64px no style, prop state passado ao Orb interno, container class

#### Coverage

| Metric     | Value  |
|------------|--------|
| Statements | 99.79% |
| Branches   | 95.49% |
| Functions  | 76.92% |
| Lines      | 99.79% |

- 157 testes, todos passando (13 arquivos de teste)
- `pnpm check` — 0 erros, 0 warnings (svelte-check)
- `pnpm build` — ✓ built in ~28s, sem erros

#### Dependencies Added

- `lucide-svelte@^1.0.1` — ícones Lucide para SvelteKit (Home, Star, Settings na Sidebar)

#### Technical details

- `$app/stores` mockado via `vi.mock('$app/stores', ...)` nos testes de Sidebar e MainLayout usando `readable()` com `pathname: '/'`
- `:has(.layout__chat)` CSS para ajuste dinâmico da grid-template-columns sem JS extra
- Partículas SVG animadas com `transform-origin: 100px 100px` (centro do viewBox 200×200) + `rotate + translateX + rotate` pattern para órbita circular real
- `tokensPerSec / 30` clamped a 1.0 passado como `--speak-intensity` CSS var (pronto para Fase 8B usar)
- Zero `any` TypeScript; Svelte 4 (sem runes)
- Todos os valores de cor via `var(--accent-*)`, zero hexadecimais hardcoded nos componentes

---

## [0.6.0] - 2026-04-17

### Fase 6: Tools web_search e web_fetch

#### Fase 6A: Tool `web_search` (DuckDuckGo HTML, sem key)

##### Added

- **`apps/api/internal/tools/types.go`** — adicionados sentinel errors: `ErrInvalidArgs`, `ErrTimeout`, `ErrSSRFBlocked`, `ErrFetchFailed`
- **`apps/api/internal/tools/web_search.go`** — tool `web_search` completa:
  - `WebSearch` struct com `httpClient`, `baseURL` (injetável), `log`, `maxResults`; opções funcionais `WithWebSearchBaseURL/HTTPClient/MaxResults`
  - `Definition()` com JSON Schema (`query` required, `max_results` 1-20 default 10)
  - `Search(ctx, query, maxResults)` exportado para reuso pelo `NewsService`
  - GET `{baseURL}/html/?q={encoded}` com User-Agent `Mozilla/5.0 (Genie/1.0)`; timeout 15s
  - Parser goquery: `.result` → `.result__title`, `.result__url`, `.result__snippet`
  - `decodeDDGRedirect()`: desempacota `/l/?uddg=<encoded>` → URL real via `url.QueryUnescape`
  - Query vazia → `ErrInvalidArgs` sem fazer request; HTTP 5xx → `ErrFetchFailed`; `Concurrent: true`
- **`apps/api/internal/tools/web_search_test.go`** — 18 testes com `httptest.NewServer`
- **`apps/api/internal/tools/testdata/ddg_search_petr4.html`** — fixture HTML com 5 resultados DDG; primeiro usa redirect `/l/?uddg=`

#### Fase 6B: Tool `web_fetch` (readability + sanitização SSRF)

##### Added

- **`apps/api/internal/tools/web_fetch.go`** — tool `web_fetch` completa:
  - `WebFetch` struct; opções funcionais `WithWebFetchHTTPClient/MaxBytes/MaxContent`; `withWebFetchSkipSSRF` (unexported, só testes)
  - `Definition()` com JSON Schema (`url` required, `format: uri`)
  - `Fetch(ctx, rawURL)` exportado para reuso
  - **SSRF protection (`validateURL`)**: rejeita schemes não-http/https; blocklist estática; `net.LookupIP` + `isPrivateIP()` (loopback, privado, link-local, multicast, unspecified)
  - `io.LimitReader(body, maxBytes+1)` + verificação de overflow → `ErrFetchFailed`
  - Extração via `go-readability.FromReader` → Article com Title, Content, Excerpt, PublishedTime, Byline, SiteName
  - Conversão HTML→Markdown via `html-to-markdown` removendo `script`, `style`, `iframe`, `noscript`, `nav`, `footer`, `header`
  - Truncação em `maxContent` runes com sufixo `\n\n[... conteúdo truncado ...]`
  - **`sanitizeContent()`**: 8 regexps compiladas contra "ignore previous instructions", `<|im_start|>`, `<|system|>`, `<<SYS>>`, `### System`, jailbreak DAN, `[INST]`
  - `FetchResult` com `URL`, `Title`, `Content`, `Excerpt`, `PublishedAt *time.Time`, `ByLine`, `SiteName`, `Length`
- **`apps/api/internal/tools/web_fetch_test.go`** — 34 testes:
  - 11 SSRF blocks (localhost, 127.0.0.1, 10.x, 169.254.x, file://, javascript:, data:, ftp://, 0.0.0.0, 192.168.x, 172.16.x)
  - `isPrivateIP` unitário (4 casos); fetch com fixtures HTML; remoção de script/style/iframe
  - Sanitização de prompt injection; truncamento; `Length`; HTTP 404/500; timeout; maxBytes overflow
  - `sanitizeContent` unitário (5 padrões); opções funcionais MaxBytes/MaxContent
- **`apps/api/internal/tools/testdata/article_petr4.html`** — fixture HTML com artigo real-like PETR4 (contém `<script>`, `<style>`, `<iframe>`)
- **`apps/api/internal/tools/testdata/article_injection.html`** — fixture HTML com tentativas de prompt injection

##### Dependencies added

- `github.com/go-shiori/go-readability v0.0.0-20251205110129-5db1dc9836f0`
- `github.com/JohannesKaufmann/html-to-markdown v1.6.0`
- `github.com/araddon/dateparse`, `github.com/go-shiori/dom`, `github.com/gogs/chardet`, `golang.org/x/sync` (indirect)

#### Coverage

- Total package `internal/tools`: **90.4%** (meta: ≥75%)
- `go test ./internal/tools/... -timeout 60s` — todos PASS
- `go build ./...` e `go vet ./...` — limpos

#### Technical details

- `withWebFetchSkipSSRF` unexported para que só testes com `httptest.NewServer` (127.0.0.1) possam bypassar SSRF; produção sempre valida
- `extractResultURL` tenta `result__url[href]` → `result__a[href]` → texto de `result__url`
- `sanitizeContent` usa regexps pré-compiladas em var-level para performance
- `io.LimitReader(body, maxBytes+1)` detecta overflow sem carregar body completo em memória

---

## [0.5.0] - 2026-04-17

### Fase 5: Agent Query Loop + SSE Streaming

#### Fase 5A: Agent — Query Loop + Tool Protocol

##### Added

- **`apps/api/internal/agent/message.go`** — Internal message types:
  - `Role` type with constants `RoleSystem`, `RoleUser`, `RoleAssistant`, `RoleTool`
  - `Message` struct with `role`, `content`, `tool_calls`, `tool_call_id`, `name` (all with proper `omitempty`)
  - `ToolCallRequest` and `ToolCallFn` for tool call data in messages

- **`apps/api/internal/agent/message_test.go`** — 6 tests: JSON round-trip for user/assistant/tool messages, omitempty behaviour, role string values, empty content omission

- **`apps/api/internal/agent/tool.go`** — Tool registry system:
  - `Tool` struct: `Name`, `Description`, `Schema` (json.RawMessage), `Handler` (ToolHandler), `Concurrent`
  - `ToolHandler` type alias: `func(ctx, json.RawMessage) (any, error)`
  - `Registry` struct with `sync.RWMutex` for thread-safe operations
  - `NewRegistry()`, `Register()` (error on duplicate), `Get()`, `List()`, `Schemas()` → `[]openrouter.Tool`

- **`apps/api/internal/agent/tool_test.go`** — 10 tests: register OK, duplicate error, get existing/nonexistent, list all, list empty, schemas conversion, schemas empty, schemas multiple, concurrent field

- **`apps/api/internal/agent/prompt.go`** — System prompt and message builder:
  - `SystemPrompt` constant with Genie identity, tools list, and behavioural rules in Brazilian Portuguese
  - `BuildMessages(history, userInput, contextData)` — assembles: system + optional context hint + history + user message
  - `buildContextHint(data)` — formats context map to readable system hint

- **`apps/api/internal/agent/prompt_test.go`** — 7 tests: no context/no history, with context, multiple context keys, with history, history+context, empty context skips hint, system prompt content validation

- **`apps/api/internal/agent/loop.go`** — Core Query Loop:
  - `LLMStreamer` interface: `StreamChat(ctx, ChatRequest) (<-chan StreamChunk, error)` — satisfied by `*openrouter.Client`
  - `Event` struct with `type` field: `token`, `tool_call_start`, `tool_call_end`, `message_end`, `error`
  - `TokenUsage` struct with prompt/completion/total tokens and optional cost
  - `QueryLoop` struct: `llm LLMStreamer`, `registry *Registry`, `model string`, `maxSteps int`, `log zerolog.Logger`
  - `NewQueryLoop(llm, reg, model, log)` — initialises with `defaultMaxSteps=20`
  - `Run(ctx, messages, emit)` — main loop: stream → token events → accumulate tool call deltas → execute tools → repeat; terminates on final text or maxSteps
  - `consumeStream` — drains SSE channel, accumulates tool call fragments by index
  - `executeTools` — dispatches tools concurrently when all have `Concurrent=true`, sequentially otherwise
  - `executeToolsParallel` — goroutine fan-out + `sync.WaitGroup` + channel collection (preserves call order)
  - `executeSingleTool` — emits start/end events, captures duration, wraps errors as `{"error":"..."}` result
  - `runTool` — looks up registry, executes handler, handles "not found" gracefully
  - `toOpenRouterMessages` — converts `[]agent.Message` → `[]openrouter.Message`
  - `ErrMaxSteps` sentinel error

- **`apps/api/internal/agent/loop_test.go`** — 11 tests:
  - `TestQueryLoop_SimpleText_NoToolCalls` — emits tokens + message_end, correct content
  - `TestQueryLoop_OneToolCall_ThenTextResponse` — tool called, IDs preserved, events emitted
  - `TestQueryLoop_TwoConcurrentToolCalls` — both handlers run, results ordered by call index
  - `TestQueryLoop_HandlerError_LoopContinues` — error captured in result JSON, message_end still emitted
  - `TestQueryLoop_ToolNotRegistered_ResultContainsError` — "tool not found" in result
  - `TestQueryLoop_MaxSteps_EmitsErrorAndReturns` — ErrMaxSteps returned, error event emitted
  - `TestQueryLoop_ContextCancelled_ReturnsCtxErr` — context.Canceled propagated
  - `TestQueryLoop_LLMError_ReturnsError` — LLM failures surfaced immediately
  - `TestQueryLoop_UsageInMessageEnd` — token counts transferred to TokenUsage
  - `TestNewQueryLoop_Defaults` — maxSteps=20, model propagated
  - `TestToOpenRouterMessages_Conversion` — all fields correctly mapped

#### Fase 5B: SSE Streaming — POST /api/chat/stream

##### Added

- **`apps/api/internal/server/chat_handler.go`** — SSE chat endpoint:
  - `Runner` interface: `Run(ctx, []agent.Message, emit) ([]agent.Message, error)` — decouples handler from concrete `*agent.QueryLoop`
  - `chatStreamRequest` struct: `conversationId`, `message`, `contextData`
  - `handleChatStream(w, r)` — full pipeline:
    1. Returns 503 when runner not configured
    2. Validates request body (400 on parse error or empty message)
    3. Creates new conversation if `conversationId` empty
    4. Loads last 20 messages from store as history
    5. Calls `agent.BuildMessages` with history + contextData
    6. Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
    7. `emit` function: marshals event to `data: {json}\n\n` + flushes
    8. Runs `runner.Run`, streams events to client
    9. Best-effort error event if Run fails
    10. Persists user message + last assistant message to store
  - `loadHistory` — fetches `GetMessages`, takes last N, converts to `[]agent.Message`
  - `persistMessages` — saves user input + last non-empty assistant response
  - `truncate` — safe rune-aware string truncation for log previews

- **`apps/api/internal/server/chat_handler_test.go`** — 9 tests:
  - `TestChatStream_NoRunner_Returns503`
  - `TestChatStream_InvalidBody_Returns400`
  - `TestChatStream_EmptyMessage_Returns400`
  - `TestChatStream_OK_ContentTypeSSE` — all 4 SSE headers verified
  - `TestChatStream_OK_SSEBodyParseable` — SSE lines parsed as JSON, correct event types
  - `TestChatStream_SSELines_DataPrefix` — `data: ` prefix and `\n\n` separator
  - `TestChatStream_CreatesConversation_WhenIDEmpty`
  - `TestChatStream_ExistingConversation_UsesHistory` — pre-created conversation history included
  - `TestChatStream_WithContextData` — PETR4 ticker injected as system context hint

##### Changed

- **`apps/api/internal/server/server.go`** — extended without breaking existing tests:
  - Added `runner Runner` field to `Server` struct (optional, nil when agent absent)
  - Added `WithRunner(r Runner) *Server` chainable method — re-registers routes and returns `*Server`
  - Added `POST /api/chat/stream` route (delegates to `handleChatStream`)
  - Route returns 503 when runner is nil (backwards-compatible)

- **`apps/api/cmd/genie/main.go`** — wired up agent:
  - `agent.NewRegistry()` — empty registry (tools added in Phase 6)
  - `openrouter.NewClient(cfg.OpenRouterAPIKey)` — production LLM client
  - `agent.NewQueryLoop(llm, reg, cfg.OpenRouterModel, log)` — query loop
  - `server.NewServer(...).WithRunner(queryLoop)` — server with agent attached

##### Coverage

- `internal/agent`: **93.8%** (target: ≥70%)
- `internal/agent/openrouter`: **86.1%**
- `internal/server`: **73.4%** (target: ≥70%)
- Global total: **84.5%** (target: ≥70%)
- All 57 new tests PASS; all existing tests continue to pass
- `go build ./...` clean; `go vet ./...` clean

---

## [0.4.0] - 2026-04-17

### Fase 6C: Tools B3 — b3_quote, b3_fundamentals, b3_search_ticker, favorites

#### Fase 6C: Tools B3 + Favorites

##### Added

- **`apps/api/internal/tools/types.go`** — package `tools`; tipos `Handler` e `Definition`; sentinel errors `ErrInvalidArgs`, `ErrTimeout`, `ErrSSRFBlocked`, `ErrFetchFailed` (compartilhados com agentes 6A/6B)
- **`apps/api/internal/tools/b3_quote.go`** — `B3QuoteTool` que delega para `b3.Source.Quote()`; args tipados `b3QuoteArgs`; mapeamento de erros de negócio → result `{"error":"..."}` para LLM; erros de sistema propagados como `error`; `Concurrent: true`
- **`apps/api/internal/tools/b3_quote_test.go`** — 8 testes: Definition, QuoteOK (struct serializável), ErrInvalidTicker, ErrTickerNotFound, ErrAllSourcesFailed, erro de sistema propagado, missing ticker, malformed JSON
- **`apps/api/internal/tools/b3_fundamentals.go`** — `B3FundamentalsTool` análogo ao b3_quote mas chama `Fundamentals()`; mesmo mapeamento de erros; `Concurrent: true`
- **`apps/api/internal/tools/b3_fundamentals_test.go`** — 8 testes com mesma cobertura do b3_quote
- **`apps/api/internal/tools/b3_search_ticker.go`** — `B3SearchTickerTool` (sem dependência de Source); chama `b3.SearchTickers(query)` + enriquece com `b3.CategoryOf` → retorna `[]TickerWithCategory`; sem chamadas de rede; `Concurrent: true`
- **`apps/api/internal/tools/b3_search_ticker_test.go`** — 7 testes: Definition, query válida retorna tickers, categoria correta (VALE3→commodities), prefix match, empty query erro, malformed JSON, no-match retorna slice vazio
- **`apps/api/internal/tools/favorites.go`** — `FavoritesTools` com 3 tools: `favorite_add` (valida ticker com `b3.ValidateTicker` antes de persistir), `favorite_remove`, `favorite_list` (retorna `[]store.Favorite`); JSON schemas para todos; logs estruturados
- **`apps/api/internal/tools/favorites_test.go`** — 14 testes usando DB in-memory real (`:memory:` + Migrate): ciclo completo add→list→remove, ticker inválido → result error, missing/malformed args, serializabilidade do result
- **`apps/api/internal/tools/registry_builder.go`** — `BuilderDeps` struct + `BuildB3Tools(deps) []Definition` que retorna exatamente 6 tools na ordem: b3_quote, b3_fundamentals, b3_search_ticker, favorite_add, favorite_remove, favorite_list
- **`apps/api/internal/tools/registry_builder_test.go`** — 6 testes: 6 tools retornadas, nomes únicos, nomes esperados na ordem certa, schemas JSON válidos com type=object, todos com handler não-nil, todos com description

##### Coverage (arquivos da Fase 6C)

| Arquivo | Cobertura |
|---------|-----------|
| `b3_quote.go` | 100% |
| `b3_fundamentals.go` | 100% |
| `b3_search_ticker.go` | 100% |
| `favorites.go` (handleAdd/Remove/List) | ~83% |
| `registry_builder.go` | 100% |

- 44 testes, todos PASS
- `go vet ./internal/tools/...` limpo
- `go build ./...` sem erros

---

## [0.3.0] - 2026-04-17

### Fase 4: Camada B3 (sem API key)

#### Fase 4A: Adapter brapi.dev

##### Added

- **`apps/api/internal/b3/types.go`** — structs públicas `Quote` e `Fundamentals` com todos os campos JSON; sentinel errors `ErrTickerNotFound`, `ErrSourceUnavailable`, `ErrAllSourcesFailed`, `ErrInvalidTicker`
- **`apps/api/internal/b3/source.go`** — interface `Source` (Name/Quote/Fundamentals); função `ValidateTicker(ticker string) error` com regex `^[A-Z]{4}[0-9]{1,2}$`
- **`apps/api/internal/b3/source_test.go`** — 17 casos de teste (valid/invalid tickers, erros sentinela distintos)
- **`apps/api/internal/b3/http.go`** — helper `newHTTPClient(timeout)` e `setCommonHeaders(req)` com User-Agent `Mozilla/5.0 (Genie/1.0; +https://github.com/joaopedro/genie)`
- **`apps/api/internal/b3/brapi.go`** — `BrapiSource` com `baseURL` injetável, suporte a `?token=`, timeout 10s; 404→`ErrTickerNotFound`, 429/5xx→`ErrSourceUnavailable`; Fundamentals via `?fundamental=true`; conversão de frações DY/ROE para %
- **`apps/api/internal/b3/brapi_test.go`** — 10 testes com `httptest.NewServer`: sucesso, 404, 429, 500, timeout, ticker inválido, token na URL, fundamentals completos e parciais

#### Fase 4B: Adapters yfinance + StatusInvest + Cascade + Cache + CircuitBreaker

##### Added

- **`apps/api/internal/b3/yfinance.go`** — `YFinanceSource` com sufixo `.SA` automático; endpoint v7 para quotes, v10 `quoteSummary` para fundamentals
- **`apps/api/internal/b3/yfinance_test.go`** — 10 testes: sucesso, 404, 429, 500, timeout, ticker inválido, sufixo .SA, fundamentals completos e parciais
- **`apps/api/internal/b3/statusinvest_scraper.go`** — `StatusInvestScraper` via goquery; scraping de preço, change, P/L, P/VP, DY, ROE, dívida, margem; `parseIndicatorValue()` trata formato brasileiro (vírgula decimal, ponto milhar, %, sinal)
- **`apps/api/internal/b3/statusinvest_scraper_test.go`** — 12 testes usando fixture HTML local sem hit em produção; testes de parser com 8 casos
- **`apps/api/internal/b3/testdata/statusinvest_petr4.html`** — fixture HTML com estrutura real do Status Invest (PETR4)
- **`apps/api/internal/b3/cache.go`** — `Cache` interface + `TTLCache` in-memory thread-safe com `sync.RWMutex`; goroutine de cleanup a cada 60s
- **`apps/api/internal/b3/cache_test.go`** — 7 testes: set/get, miss, expiração, delete, overwrite, concurrent (50 goroutines), múltiplos TTLs
- **`apps/api/internal/b3/breaker.go`** — `CircuitBreaker` por key; threshold 3 falhas em janela 60s → abre por 30s; clock injetável via interface
- **`apps/api/internal/b3/breaker_test.go`** — 8 testes com `mockClock` determinístico: inicialmente fechado, abre após threshold, fecha após 30s, success reseta, janela expira, keys independentes
- **`apps/api/internal/b3/cascade.go`** — `Cascade` que tenta sources em ordem; cache quotes TTL=60s, fundamentals TTL=24h; skip de sources com circuit aberto
- **`apps/api/internal/b3/cascade_test.go`** — 12 testes com `stubSource`: first success, fallback, all fail, cache hit, invalid ticker, open circuit skip

##### Dependencies added

- `github.com/PuerkitoBio/goquery v1.12.0`
- `github.com/andybalholm/cascadia v1.3.3` (indirect)
- `golang.org/x/net v0.52.0` (indirect)

#### Fase 4C: Lista de tickers e categorias

##### Added

- **`apps/api/internal/b3/categories.go`** — tipo `Category` + 7 constantes; `tickersByCategory` com 30 tickers IBOV; reverse index O(1) via `init()`; `TickersFor`, `CategoryOf` (case-insensitive), `AllCategories`, `AllTickers` (dedup), `SearchTickers` (prefix match)
- **`apps/api/internal/b3/categories_test.go`** — 14 testes cobrindo todas as funções, lookup case-insensitive, sem duplicatas

#### Coverage

- Total package `internal/b3`: **88.7%** (meta: ≥75%)
- 88 testes, todos PASS
- `go build ./...` sem erros
- `go vet ./internal/b3/...` sem warnings

---

## [0.2.1] - 2026-04-17

### Fase 3A: Backend — servidor HTTP estruturado + SQLite + logger

#### Added

- **`apps/api/internal/lib/logger/logger.go`** — wrapper sobre zerolog:
  - `New(level string) zerolog.Logger` — console writer para stderr com timestamp + caller
  - `NewWithWriter(level, io.Writer)` — variante para testes injetarem buffer
  - `WithContext(ctx, logger)` / `FromContext(ctx)` — propagação de logger via context
  - Fallback para info-level quando nenhum logger está no context
- **`apps/api/internal/lib/logger/logger_test.go`** — 7 testes: filtragem por nível (debug/info/warn/error), fallback em nível inválido, propagação de context
- **`apps/api/internal/store/migrations/001_init.sql`** — schema SQLite inicial (embedded):
  - `favorites (ticker PK, added_at, last_news_at)`
  - `news_cache (id, ticker, url UNIQUE, title, source, summary, published_at, fetched_at)` + índice `idx_news_ticker`
  - `conversations (id TEXT PK, title, created_at, updated_at)`
  - `messages (id, conversation_id FK, role, content JSON, created_at)`
- **`apps/api/internal/store/db.go`** — wrapper `*sql.DB` com `modernc.org/sqlite`:
  - `Open(dbPath string) (*DB, error)` — abre/cria DB, habilita WAL + FK enforcement + busy_timeout=5000
  - `Migrate(ctx) error` — aplica `001_init.sql` via `//go:embed`, idempotente (IF NOT EXISTS)
  - `SQL() *sql.DB`, `Close()`, `Ping(ctx)`
- **`apps/api/internal/store/db_test.go`** — 7 testes: open in-memory, migrate aplica schema, idempotência, PRAGMA table_info para favorites e messages, Ping, Close
- **`apps/api/internal/store/favorites.go`** — `FavoritesRepo`:
  - `AddFavorite` (INSERT OR IGNORE), `RemoveFavorite`, `ListFavorites`, `IsFavorite`
  - Struct `Favorite { Ticker, AddedAt, LastNewsAt *time.Time }`
- **`apps/api/internal/store/favorites_test.go`** — 6 testes: add/list, idempotência, remove, IsFavorite, remove não-existente, AddedAt populado
- **`apps/api/internal/store/conversations.go`** — `ConversationsRepo`:
  - `CreateConversation(ctx, title) (id, error)` — ID hex 32 chars via `crypto/rand`
  - `AppendMessage(ctx, convID, role, contentJSON)` — insere + atualiza `updated_at`
  - `GetMessages(ctx, convID)` — ordem cronológica
  - `ListConversations(ctx, limit, offset)` — paginação por `updated_at DESC`
- **`apps/api/internal/store/conversations_test.go`** — 5 testes: criar, append + get mensagens em ordem, paginação, get vazio, IDs únicos
- **`apps/api/internal/server/server.go`** — servidor HTTP estruturado:
  - `type Server struct { router, cfg, db, log }` — extraído do main
  - `NewServer(cfg, db, log) *Server` — monta router com CORS + RequestID + RealIP + requestLogger + Recoverer + Timeout(30s)
  - `Start(ctx) error` — graceful shutdown via `ctx.Done()`
  - `ServeHTTP` — implementa `http.Handler` (testável com httptest)
  - `GET /health` — retorna `{ status, version, db }` com ping ao SQLite
  - `GET /api/config` — retorna `{ version, model }` **sem expor API key**
- **`apps/api/internal/server/server_test.go`** — 6 testes: health 200 + campos, db status ok, config sem key, 404, 405, health com DB fechado

#### Changed

- **`apps/api/cmd/genie/main.go`** — simplificado para pipeline: `config.Load()` → `logger.New()` → `store.Open()` + `Migrate()` → `server.NewServer()` → `Start()`; usa `signal.NotifyContext` para graceful shutdown
- **`apps/api/cmd/genie/main_test.go`** — atualizado para usar `server.NewServer` via httptest

#### Fixed

- **`apps/api/internal/b3/source.go`** — `ValidateTicker()` não convertia para uppercase antes de validar, causando falha de teste em ticker minúsculo; removido `strings.ToUpper` para rejeitar corretamente casing incorreto

#### Dependencies Added

- `modernc.org/sqlite v1.48.2` — driver SQLite puro Go, sem CGO (funciona no Windows sem toolchain C)

#### Technical details

- `go vet ./...` limpo
- `go test ./... -timeout 60s` todos passando
- Cobertura global: **82.5%** (meta: ≥70%)

---

### Fase 3B: Backend — config + cliente OpenRouter

#### Added

- **`apps/api/internal/lib/config/config.go`** — `Config` struct + `Load()`:
  - Campos: `Port`, `DBPath`, `OpenRouterAPIKey`, `OpenRouterModel`, `LogLevel`, `BrapiToken`, `NewsCacheTTL`, `QuoteCacheTTL`
  - Auto-load `.env` via godotenv; defaults aplicados para campos opcionais
  - Validações: `OPENROUTER_API_KEY` obrigatório; `PORT` número válido; `LOG_LEVEL` em debug|info|warn|error; TTLs inteiros válidos
  - `Redacted() Config` — mascara `OpenRouterAPIKey` como `sk-***` para uso seguro em logs
- **`apps/api/internal/lib/config/config_test.go`** — 8 testes: carga completa, defaults, API key ausente, port inválida, log level inválido, TTLs inválidos, chave mascarada no Redacted()
- **`apps/api/internal/agent/openrouter/client.go`** — cliente HTTP para OpenRouter API (OpenAI-compat):
  - Structs: `ChatRequest`, `Message`, `Tool`, `ToolCall`, `StreamChunk`, `Usage`
  - `NewClient(apiKey, opts...)` / `NewClientWithBaseURL(apiKey, baseURL, opts...)`
  - `StreamChat(ctx, req) (<-chan StreamChunk, error)` — faz HTTP sincronamente (retorna erro imediato em 4xx não-retryable), stream SSE em goroutine
  - SSE parser com `bufio.Scanner`, suporte a delta texto e tool_call deltas
  - Non-stream: parseia JSON e emite um `StreamChunk`
  - Headers obrigatórios: `Authorization: Bearer`, `HTTP-Referer`, `X-Title`
  - Retry com backoff exponencial (max 3 tentativas) em 429 e 5xx; sem retry em 401/403/404
  - Options funcionais: `WithRetryDelays(...)`, `WithTimeout(...)`
- **`apps/api/internal/agent/openrouter/client_test.go`** — 7 testes com `httptest.Server`: SSE OK, 3 chunks + [DONE], tool_call delta, 429→retry→sucesso, 401 sem retry, conexão fechada, non-stream OK

#### Security

- `OPENROUTER_API_KEY` nunca logada diretamente; sempre via `cfg.Redacted()` que substitui por `sk-***`
- Config endpoint `GET /api/config` não expõe a chave (testado explicitamente em `TestConfig_Returns200_WithoutAPIKey`)

---

## [0.2.0] - 2026-04-17

### Fase 2: Design System Orb Quantum

#### Fase 2: Design System Orb Quantum

#### Added

- **`apps/web/src/lib/components/ui/Button.svelte`** — botão reutilizável com variants `primary` (dark bg + gold border + violet glow on hover), `ghost` (transparente), `danger` (red border). Props: `variant`, `size` (sm/md/lg), `disabled`, `loading`. Emite evento `click`. Active state `scale(0.98)`, hover `translateY(-2px)` com transição 280ms.

- **`apps/web/src/lib/components/ui/Card.svelte`** — glass card com border gradient gold+lilac via pseudo-elemento `::before`. Props: `variant` (default/glass/elevated), `padding` (sm/md/lg), `hoverable`. Shadow `--shadow-card`, hover lift `translateY(-4px)`.

- **`apps/web/src/lib/components/ui/Input.svelte`** — input de texto com focus ring lilac (`box-shadow: 0 0 0 4px rgba(167,155,255,0.12)`). Props: `value` (bindable para text), `placeholder`, `type` (text/email/password/search/number), `disabled`, `error`. Emite `input`, `change`, `keydown`. Estado de erro com `aria-invalid` e mensagem via `role="alert"`. Workaround para limitação Svelte 4 (bind:value + dynamic type incompatíveis).

- **`apps/web/src/lib/components/ui/Badge.svelte`** — pill colorido. Props: `variant` (success/warning/error/info/neutral/gold), `size` (sm/md). Usa variáveis `--status-*` e `--accent-gold`.

- **`apps/web/src/lib/components/ui/Skeleton.svelte`** — loading placeholder com shimmer lilac. Props: `width`, `height`, `rounded` (sm/md/lg/full). Animação `skeleton-shimmer` 900ms infinite usando `--dur-cinematic`.

- **`apps/web/src/lib/components/ui/IconButton.svelte`** — botão só-ícone quadrado. Props: `label` (aria-label obrigatório), `size` (16/20/24px), slot para ícone SVG/Lucide. Dimensões via mapa de tamanhos.

- **`apps/web/src/lib/components/ui/index.ts`** — barrel export de todos os primitivos UI.

- **`apps/web/src/routes/design-system/+page.svelte`** — página de showcase (não-produção) exibindo todos os 6 primitivos em todas as variants, paleta de cores com swatches, background `var(--gradient-bg)`.

- **`apps/web/src/lib/test-setup.ts`** — setup de testes importando `@testing-library/jest-dom`.

- **Testes** (104 no total, todos passando):
  - `Button.test.ts` — 13 testes (render, variants, sizes, states, click, disabled, loading, aria-busy, spinner)
  - `Card.test.ts` — 8 testes (render, variants, padding, hoverable)
  - `Input.test.ts` — 28 testes (render, placeholder, value, disabled, error, aria-invalid, eventos, todos os types)
  - `Badge.test.ts` — 9 testes (render, 6 variants, 2 sizes)
  - `Skeleton.test.ts` — 7 testes (render, aria-hidden, role, width, height, rounded)
  - `IconButton.test.ts` — 7 testes (render, aria-label, click, disabled, sizes)

#### Changed

- **`apps/web/vite.config.ts`** — adicionado `environmentMatchGlobs` para usar `jsdom` em testes de componentes e `node` para testes de tokens. `globals: true`, `setupFiles`, `coverage` configurado com `@vitest/coverage-v8` incluindo apenas `src/lib/**`.

#### Dependencies Added

- `@testing-library/svelte@5.3.1` — render de componentes Svelte em testes
- `@testing-library/jest-dom@6.9.1` — matchers DOM (toBeInTheDocument, toBeDisabled, etc.)
- `@testing-library/user-event@14.6.1` — simulação de eventos de usuário
- `jsdom@29.0.2` — ambiente DOM para testes unitários
- `@vitest/coverage-v8@2.1.9` — coverage provider compatível com Vitest 2.1.9

#### Coverage report (src/lib/** apenas)

| Metric     | Value  |
|------------|--------|
| Statements | 99.82% |
| Branches   | 93.83% |
| Functions  | 83.33% |
| Lines      | 99.82% |

Meta de 70% global superada em todas as métricas.

#### Technical details

- Svelte 4 não suporta `bind:value` com `{type}` dinâmico em `<input>` — contornado via `{#if}` por tipo + `onInput` helper function sem cast TypeScript no template
- Border gradient do Card implementado via `::before` com `mask-composite: exclude` (inclui vendor prefix `-webkit-mask` + standard `mask` para evitar warning no svelte-check)
- `--dur-cinematic` (900ms) usado para skeleton shimmer, alinhado ao `lineShimmer` do design system
- Todas as animações usam `var(--ease-standard)` ou `ease-in-out` do tema
- Zero hardcode de valores hexadecimais nos componentes — 100% via CSS vars

---

## [0.1.0] - 2026-04-17

### Fase 1: Scaffold do monorepo

#### Added

- **`go.work`** — Go workspace pointing to `apps/api`
- **`apps/api/go.mod`** — module `github.com/joaopedro/genie/api`, Go 1.23, deps: chi v5.1.0, cors v1.2.1, godotenv v1.5.1, zerolog v1.33.0
- **`apps/api/cmd/genie/main.go`** — HTTP server (chi) on `PORT` (default 5858):
  - `GET /health` → `{"status":"ok","version":"0.1.0"}`
  - CORS middleware (localhost:5173, localhost:4173)
  - zerolog structured request logger
  - Graceful shutdown via `SIGINT`/`SIGTERM` with 10s timeout
- **`apps/api/cmd/genie/main_test.go`** — unit tests for `handleHealth` (status 200, JSON body validation)
- **`apps/api/internal/*/` placeholders** — `.gitkeep` in server, agent, tools, b3, news, store, jobs, lib
- **`apps/web/`** — SvelteKit 2 + Svelte 4 + TypeScript 5.5 + Vite 5 + adapter-static
  - `src/app.html` — loads Sora + Inter + Space Grotesk from Google Fonts
  - `src/lib/theme/orb-quantum.css` — full Orb Quantum design token set (`:root` vars + base reset + keyframe animations)
  - `src/routes/+layout.svelte` — imports theme CSS globally
  - `src/routes/+page.svelte` — hero page with Orb placeholder (radial gradient), branded title, "em construção" badge
  - `src/lib/theme/theme.test.ts` — Vitest tests verifying 29+ CSS tokens are present
- **`packages/shared/src/types.ts`** — shared TypeScript types: `Quote`, `Article`, `Message`, `StreamEvent`, `Category`
- **`pnpm-workspace.yaml`** — workspaces: `apps/*`, `packages/*`
- **`package.json`** (root) — scripts: `dev`, `build`, `test`, `api:dev`, `api:test`, `api:cover`
- **`.env.example`** — all env vars documented with defaults
- **`.gitignore`** — node_modules, dist, .svelte-kit, *.db, .env, coverage.out, *.log
- **`docs/DEVELOPMENT_PLAN.md`** — phase summary table
- **`docs/ARCHITECTURE.md`** — architecture diagram + request flow
- **`README.md`** — full project documentation (badges, features table, mermaid diagram, tech stack, setup guide)
- **`LICENSE`** — MIT, copyright 2026 João Pedro

#### Technical details

- Go module path: `github.com/joaopedro/genie/api`
- API default port: `5858`
- Frontend dev server: `localhost:5173` (Vite default)
- SQLite will be added in Fase 3A using `modernc.org/sqlite` (no CGO)
- Theme tokens sourced from `ia_system_design.md` (Orb Quantum Design System v1.0.0)
