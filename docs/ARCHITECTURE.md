# Genie — Architecture

## Overview

Genie is a local-first financial assistant. The Go API handles agent orchestration and B3 data; SvelteKit serves the UI via SSE streaming. All state is persisted in a local SQLite database — no external database required.

---

## High-Level Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    User Browser                            │
│  SvelteKit SPA (adapter-static, localhost:5173 in dev)     │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  +page.svelte (home)   asset/[ticker]/   favorites/ │   │
│  │       ↕ SSE                  ↕ REST          ↕ REST │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼───────────────────────────────────┐
│              Go API  (chi, localhost:5858)                  │
│                                                            │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │ /health  │  │ /api/chat │  │/api/news │  │/api/favs │  │
│  └──────────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘  │
│                      │             │              │         │
│              ┌───────▼─────────────▼──────────────▼──────┐ │
│              │            internal/                       │ │
│              │  ┌─────────┐  ┌─────────┐  ┌──────────┐  │ │
│              │  │  agent/ │  │  news/  │  │  store/  │  │ │
│              │  │QueryLoop│  │ scraper │  │ SQLite   │  │ │
│              │  └────┬────┘  └────┬────┘  └──────────┘  │ │
│              │       │            │                       │ │
│              │  ┌────▼────┐  ┌────▼────┐                 │ │
│              │  │ tools/  │  │   b3/   │                 │ │
│              │  │web_srch │  │ cascade │                 │ │
│              │  │web_fetch│  │ brapi → │                 │ │
│              │  │b3_quote │  │ yfinance│                 │ │
│              │  └─────────┘  └─────────┘                 │ │
│              └───────────────────────────────────────────┘ │
│                                                            │
│              ┌────────────────────────────────────────┐    │
│              │  jobs/ (cron 08:00 BRT weekdays)       │    │
│              │  → RefreshFavoritesNews                │    │
│              └────────────────────────────────────────┘    │
└──────────────────────────┬─────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   brapi.dev       Yahoo Finance        Status Invest
   (primary)       (secondary)          (scraping fallback)
                           │
                    OpenRouter API
                 (anthropic/claude-sonnet-4.6)
```

---

## Request Flow — Chat Message

```
1. User types message in ChatInput.svelte
2. POST /api/chat/stream  {conversationId, message}
3. Server opens SSE stream → client receives events
4. agent.QueryLoop.Run(ctx, messages, eventCh):
   a. OpenRouter.ChatCompletion(messages, tools) → stream tokens → SSE{type:"token"}
   b. LLM requests tool_call(s):
      - web_search("PETR4 notícias") → DuckDuckGo HTML → []SearchResult
      - web_fetch(url)               → readability → markdown (max 8000 chars)
      - b3_quote("PETR4")           → CascadeSource{brapi→yfinance→scraping}
      - favorite_add("PETR4")       → SQLite INSERT
      Each tool emits SSE{type:"tool_call_start"} … SSE{type:"tool_call_end"}
   c. Tool results appended to messages; loop continues (max 20 iterations)
   d. LLM returns final message → SSE{type:"message_end", usage}
5. Frontend renders markdown response + collapsible tool calls
```

---

## Package Structure

| Package | Responsibility |
|---------|----------------|
| `cmd/genie` | Entrypoint: server boot, graceful shutdown |
| `internal/server` | Chi router, middleware, SSE handler |
| `internal/agent` | QueryLoop, tool dispatcher, OpenRouter client |
| `internal/tools` | web_search, web_fetch, b3_*, favorites_* implementations |
| `internal/b3` | CascadeSource (brapi → yfinance → scraping), CircuitBreaker, TTLCache |
| `internal/news` | NewsService: fetch + cache articles by category/ticker |
| `internal/store` | SQLite driver, migrations, query helpers |
| `internal/jobs` | Cron scheduler: daily favorites news refresh |
| `internal/lib` | Logger (zerolog), config (env), HTTP client factory |

---

## Observability

### Logger
- **Package**: `internal/lib/logger/` — thin wrapper over `zerolog`.
- Every log entry carries a timestamp and caller field.
- Request handler logs include: `method`, `path`, `status`, `duration_ms`, `request_id`, and domain fields (`ticker`, `conversation_id`, `category`, etc.).
- Level controlled via `LOG_LEVEL` env var (`debug|info|warn|error`, default `info`).

### Middleware (Fase 13)
Registered via `server.RequestID()`, `server.RequestLogger()`, and `server.Recoverer()` — defined in `internal/server/middleware.go`:

| Middleware | Purpose |
|-----------|---------|
| `RequestID()` | Reads `X-Request-ID` header or generates an 8-byte hex ID; injects into context and response header |
| `RequestLogger(log, reg)` | Structured log per request (method, path, status, duration_ms, bytes, request_id, remote_addr); increments metrics counters/timers when a `*metrics.Registry` is provided |
| `Recoverer(log)` | Catches panics, logs stack trace with `request_id`, returns HTTP 500 |

### In-Memory Metrics (Fase 13)
- **Package**: `internal/lib/metrics/` — zero external dependencies.
- Thread-safe registry with three metric types:

| Type | Description |
|------|-------------|
| `Counter` | Monotonically increasing int64 — atomic ops |
| `Timer` | Rolling window ring buffer (last 1000 observations); computes p50/p95/p99/max in milliseconds |
| `Gauge` | Float64 that can go up or down |

- Canonical key format: `name{label1=val1,label2=val2}` (labels sorted alphabetically).
- `Registry.Snapshot()` returns a deep copy safe for JSON serialisation.

**Metrics currently emitted**:

| Name | Type | Labels | Description |
|------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `status` (2xx/4xx/5xx) | Total HTTP requests by method and status class |
| `http_request_duration` | Timer | `method`, `route` | Request duration using chi route pattern |

### Endpoint `/api/metrics`
- `GET /api/metrics` — returns `registry.Snapshot()` as JSON.
- **Auth**: if `ADMIN_TOKEN` is set, requires matching `X-Admin-Token` header; otherwise publicly accessible (suitable for local dev).
- Registered only when `server.WithMetrics(reg)` is called.

### Expanding Observability
To replace in-memory metrics with Prometheus:
1. Install `github.com/prometheus/client_golang`.
2. Replace `internal/lib/metrics` with a thin adapter implementing the same `Counter`/`Timer`/`Gauge` interface backed by Prometheus types.
3. Expose `/metrics` via `promhttp.Handler()` instead of the custom JSON snapshot.

To add OpenTelemetry traces:
1. Wire `go.opentelemetry.io/otel` with an OTLP exporter.
2. Add a span in `RequestLogger` and propagate via context to tool calls and DB queries.
3. The `request_id` already serves as a correlation ID; map it to `trace_id` for distributed tracing.

---

## Security Considerations

| Threat | Mitigation |
|--------|------------|
| SSRF in `web_fetch` | Block private/loopback IPs; allow only http/https; 30s timeout |
| Prompt injection via web content | Strip "ignore previous instructions" patterns before passing to LLM |
| SQL injection | `database/sql` parameterized queries exclusively |
| XSS | Svelte auto-escapes; no `{@html}` on remote data without DOMPurify |
| API key exposure | `OPENROUTER_API_KEY` stays server-side only; never sent to frontend |
| Rate limiting | 30 req/min per IP on `/api/chat/*` |
| Sensitive logs | Never log API keys or tokens; mask with `***` |
