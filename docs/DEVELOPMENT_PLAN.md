# Genie — Development Plan

> Living document. Update at the end of each SubFase before committing.
> Full master plan: `docs/plans/00-genie-master-plan.md`

---

## Phase Roadmap

| Phase | Title | Effort | Depends On | Status |
|-------|-------|--------|------------|--------|
| **1** | Scaffold do monorepo | 2h | — | Done |
| **2** | Design system Orb Quantum (tokens + primitivos) | 3h | 1 | Pending |
| **3A** | Backend: servidor HTTP + SQLite + logger | 2h | 1 | Pending |
| **3B** | Backend: config + OpenRouter client | 2h | 3A | Pending |
| **4A** | Camada B3: adapter brapi.dev | 2h | 3A | Pending |
| **4B** | Camada B3: adapter yfinance + cascata + cache | 3h | 4A | Pending |
| **4C** | Camada B3: lista de tickers + categorias | 1h | 4A | Pending |
| **5A** | Agente: Query Loop + tool protocol (OpenRouter) | 4h | 3B | Pending |
| **5B** | Agente: SSE streaming para o frontend | 2h | 5A | Pending |
| **6A** | Tool `web_search` (DuckDuckGo HTML, sem key) | 2h | 5A | Pending |
| **6B** | Tool `web_fetch` (readability + sanitização) | 2h | 6A | Pending |
| **6C** | Tools B3: `b3_quote`, `b3_fundamentals`, `b3_search_ticker` | 2h | 4B, 5A | Pending |
| **7** | Serviço de notícias (scraper + cache 30min) | 3h | 6B | Pending |
| **8A** | Frontend: shell + layout (sidebar + chat panel) | 3h | 2 | Pending |
| **8B** | Frontend: cliente API + store de chat (SSE) | 2h | 8A, 5B | Pending |
| **9** | Mascote Orb animado (SVG + CSS + reactive states) | 4h | 2, 8A | Pending |
| **10A** | Home: grid de categorias + feed de notícias | 3h | 7, 8A | Pending |
| **10B** | Home: chat aberto com mascote | 3h | 8B, 9 | Pending |
| **11** | Página de ativo `/asset/[ticker]` | 4h | 10A, 6C | Pending |
| **12A** | Favoritos: tool + store + UI (star button) | 2h | 5A, 8A | Pending |
| **12B** | Job diário: varredura de notícias dos favoritos | 3h | 7, 12A | Pending |
| **13** | Observabilidade + testes (unit + integração) | 4h | all | Pending |
| **14** | Packaging (single binary + embed frontend) | 2h | 13 | Pending |

**Total estimated:** ~55h across ~20 deliverable SubPhases.

---

## Definition of Done (global)

- [ ] `go build ./...` + `pnpm build` pass without errors
- [ ] `go test ./...` with coverage >= 70%
- [ ] Home shows news for 6 main categories
- [ ] Chat works with SSE streaming and shows collapsible tool calls
- [ ] Orb mascot animates in all 5 states
- [ ] Favorites persist in SQLite and appear at `/favorites`
- [ ] Daily job configured (testable via `POST /api/admin/jobs/refresh-favorites`)
- [ ] "Como está a Petrobras?" returns updated quote + 2-3 news articles with sources
- [ ] Works offline for cached data (graceful fallback if network goes down)
- [ ] CHANGELOG.md updated per SubPhase

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `anthropic/claude-sonnet-4.6` | LLM model |
| `PORT` | No | `5858` | API server port |
| `DB_PATH` | No | `./genie.db` | SQLite database path |
| `LOG_LEVEL` | No | `info` | `debug\|info\|warn\|error` |
| `NEWS_CACHE_TTL_MINUTES` | No | `30` | News cache TTL |
| `QUOTE_CACHE_TTL_SECONDS` | No | `60` | Quote cache TTL |
| `BRAPI_TOKEN` | No | — | Increases brapi.dev rate limits |
