# Genie — Arquitetura

Genie é um assistente financeiro local-first. O backend TypeScript (Fastify) cuida da orquestração do agente e dos dados B3; o SvelteKit serve a UI via SSE streaming. Todo o estado é persistido em SQLite local — nenhum banco externo necessário.

---

## Visão Geral

```
┌──────────────────────────────────────────────────────────────┐
│                     SvelteKit Frontend                        │
│            (Vite dev: :5173  /  SSG build: /build)           │
│   Home · Favoritos · Rankings · Ativo · Chat                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP / SSE  (proxy → :5858)
┌───────────────────────────▼──────────────────────────────────┐
│              Fastify API  (Node 22, localhost:5858)           │
│                                                               │
│  POST /api/chat/stream   ← SSE streaming                     │
│  GET  /api/b3/quote/:ticker                                   │
│  GET  /api/b3/fundamentals/:ticker                            │
│  GET  /api/b3/search?q=                                       │
│  GET  /api/b3/categories                                      │
│  GET  /api/news?category=|ticker=                             │
│  GET/POST/DELETE /api/favorites                               │
│  GET  /health                                                 │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├── QueryLoop (agent/loop.ts)
       │     └── OpenRouterClient → LLM (streaming SSE)
       │           └── Tools: b3_quote, b3_fundamentals,
       │                      b3_search_ticker, web_search,
       │                      web_fetch, favorite_add/remove/list
       │
       ├── B3 Cascade (b3/cascade.ts)
       │     ├── 1. BrapiSource        (brapi.dev API)
       │     ├── 2. YFinanceSource     (Yahoo Finance v7/v10)
       │     ├── 3. StatusInvestScraper (cheerio)
       │     ├── 4. GoogleFinanceSource (scraper)
       │     └── 5. FundamentusSource  (ISO-8859-1 scraper)
       │           + TTLCache (5min quotes, 24h fundamentals)
       │           + CircuitBreaker (3 falhas → 30s open)
       │
       ├── NewsService (news/service.ts)
       │     └── WebSearch (DuckDuckGo + Google News RSS)
       │           └── SQLite cache (news_articles)
       │
       ├── Scheduler (jobs/scheduler.ts — croner)
       │     ├── daily-favorites-news  (08h seg-sex)
       │     └── news-refresh          (a cada hora)
       │
       └── SQLite (better-sqlite3, WAL mode)
             ├── conversations + messages
             ├── favorites
             └── news_articles
```

---

## Camadas

### `src/agent/`

| Arquivo | Responsabilidade |
|---|---|
| `loop.ts` | `QueryLoop` — loop de tool-calling até 20 passos, paraleliza tools `concurrent: true` |
| `openrouter.ts` | `OpenRouterClient` — SSE streaming com retry exponencial (1s/2s/4s) |
| `tool.ts` | `Registry` — registra e despacha tools |
| `prompt.ts` | System prompt + `buildMessages` com injeção de contexto (favoritos, notícias) |
| `message.ts` | Tipos `Message`, `ToolCallRequest`, `Role` |

### `src/b3/`

| Arquivo | Responsabilidade |
|---|---|
| `cascade.ts` | Orquestra as 5 fontes com cache e circuit breaker |
| `cache.ts` | `TTLCache<T>` — in-memory, cleanup via `setInterval` unref'd |
| `breaker.ts` | `CircuitBreaker` — 3 falhas em 60s abre por 30s; `Clock` injetável para testes |
| `brapi.ts` | API brapi.dev — quote + fundamentals (requer token para fundamentals completos) |
| `yfinance.ts` | Yahoo Finance v7 (quote) + v10 quoteSummary (fundamentals); sufixo `.SA` |
| `statusinvest.ts` | Scraper cheerio — seletores do redesign 2025 |
| `googlefinance.ts` | Scraper — extrai `data-last-price` e JSON-LD do Google Finance |
| `fundamentus.ts` | Scraper ISO-8859-1 — cobre small/mid caps da B3 que as APIs não têm |
| `categories.ts` | Mapa estático ticker→setor, reverse index O(1), `searchTickers` por prefixo |

### `src/news/`

`NewsService` implementa cache em 3 camadas:
1. **L1** — `TTLCache` in-memory (5 min)
2. **L2** — SQLite (`news_articles`) — fresco se `fetched_at` < 2h
3. **L3** — Web search fallback (DuckDuckGo + Google News RSS)

### `src/tools/`

Cada tool implementa a interface `Tool` (name, description, schema JSON, handler, concurrent):

| Tool | `concurrent` | Descrição |
|---|---|---|
| `b3_quote` | ✅ | Cotação atual via Cascade |
| `b3_fundamentals` | ✅ | Fundamentos via Cascade |
| `b3_search_ticker` | ✅ | Busca por prefixo no índice estático |
| `web_search` | ✅ | DuckDuckGo HTML scraping |
| `web_fetch` | ✅ | Readability + Turndown + sanitização anti-prompt-injection |
| `favorite_add` | ❌ | Persiste no SQLite |
| `favorite_remove` | ❌ | Remove do SQLite |
| `favorite_list` | ✅ | Lista do SQLite |

### `src/server/`

Pipeline Fastify:
```
CORS → rate-limit → onResponse logger → routes → error handler
```

O chat SSE usa `reply.raw.write()` diretamente para streaming compatível com EventSource.

### `src/store/`

Migrations SQL em `src/store/migrations/` aplicadas via `better-sqlite3` no boot com `WAL`, `PRAGMA foreign_keys = ON` e `PRAGMA busy_timeout = 5000`.

### `src/jobs/`

`Scheduler` (croner) com single-flight guard por job name e timeout de 5 min por execução.

---

## Observabilidade

- Logs estruturados via **pino** com child loggers por contexto (`b3`, `agent`, `news`, `job`)
- Todo request logado: `method`, `path`, `status`, `durationMs`
- Circuit breaker abre após 3 falhas consecutivas dentro de 60s e fecha automaticamente após 30s

---

## Roadmap

- [ ] Trocar DuckDuckGo scraping por SearXNG self-hosted para buscas mais estáveis
- [ ] Adicionar métricas Prometheus via `prom-client`
- [ ] Avaliar Bun como runtime
- [ ] Autenticação multi-usuário (hoje é single-user local)
