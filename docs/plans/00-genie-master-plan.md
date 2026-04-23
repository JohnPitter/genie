# Genie — Plano Mestre de Implementação

> Assistente financeiro conversacional com mascote animado, dados da B3 e agente LLM via OpenRouter.
> **Stack:** Monorepo Go (backend) + SvelteKit (frontend) + SQLite (local) + Orb Quantum Design System.
> **Data do plano:** 2026-04-17

---

## 1. Objetivo

Construir uma aplicação web local-first onde o usuário conversa com um **agente financeiro** (mascote "Genie" — uma esfera holográfica animada) que:

1. Responde perguntas abertas sobre **qualquer ativo listado na B3** (ações, FIIs, ETFs, BDRs).
2. Mostra na **home** as notícias das maiores ações por categoria (Bancos, Commodities, Varejo, Tecnologia, Energia, Saneamento) + um **chat aberto**.
3. Varre notícias, pareceres e notas técnicas recentes via **WebSearch + WebFetch** (padrão tool-calling inspirado em *the-harness*).
4. Permite **favoritar ações** e atualiza automaticamente (job diário) as notícias dos favoritos.
5. Funciona **sem API key paga da bolsa** — usa fontes públicas gratuitas (brapi.dev, Yahoo Finance unofficial, scraping de páginas públicas da B3/Status Invest/Fundamentus).

### Princípios norteadores
- **Tool-calling puro**: o agente decide quando chamar `web_search`, `web_fetch`, `b3_quote`, `b3_fundamentals`, `favorite_add` — inspirado no Query Loop + Tool System do harness.
- **Zero-config inicial**: o usuário só precisa de uma chave OpenRouter.
- **Orb Quantum como identidade**: estética dark premium, violet glow, champagne gold, mascote esfera com `orbBreathing` + `pulseGlow` como personagem central da marca.
- **Resiliência**: fontes B3 em cascata (brapi → yfinance → scraping) com circuit breaker.

---

## 2. Arquitetura de alto nível

```
genie/
├── apps/
│   ├── api/                    # Backend Go (orchestrator + agent runtime)
│   │   ├── cmd/genie/          # main.go
│   │   └── internal/
│   │       ├── server/         # HTTP (chi) + SSE streaming
│   │       ├── agent/          # Query Loop + Tool System (OpenRouter)
│   │       ├── tools/          # web_search, web_fetch, b3_*, favorites_*
│   │       ├── b3/             # adapters para fontes B3 (cascata)
│   │       ├── news/           # scraper + cache
│   │       ├── store/          # SQLite + migrations
│   │       ├── jobs/           # cron: daily favorites refresh
│   │       └── lib/            # logger, config, encryption, http client
│   └── web/                    # SvelteKit frontend
│       ├── src/
│       │   ├── lib/
│       │   │   ├── components/ # Orb, Chat, NewsCard, AssetCard, FavoriteStar
│       │   │   ├── theme/      # orb-quantum.css (design tokens)
│       │   │   └── api/        # cliente SSE + REST
│       │   ├── routes/
│       │   │   ├── +layout.svelte       # sidebar + chat panel
│       │   │   ├── +page.svelte         # home (categorias + chat)
│       │   │   ├── asset/[ticker]/      # detalhe do ativo
│       │   │   ├── favorites/           # lista de favoritos
│       │   │   └── settings/            # API key OpenRouter
│       │   └── app.html
│       └── svelte.config.js
├── packages/
│   └── shared/                 # tipos TS + constantes (gerados a partir de Go via openapi ou manual)
│       └── src/types.ts
├── docs/
│   ├── plans/                  # planos das fases
│   ├── DEVELOPMENT_PLAN.md
│   └── ARCHITECTURE.md
├── .env.example
├── CHANGELOG.md
├── go.work                     # Go workspace
├── pnpm-workspace.yaml
└── package.json
```

### Fluxo de uma pergunta do usuário

```
Usuário digita no chat (SvelteKit)
  → POST /api/chat/stream (SSE)
  → agent.QueryLoop.Run(messages)
       ↓
       loop:
         1. OpenRouter.ChatCompletion(messages, tools)  ──► stream de tokens para o frontend
         2. Se LLM pede tool_call:
              - web_search("PETR4 notícias"):  DuckDuckGo HTML → lista URLs
              - web_fetch(url):                 HTTP GET + readability → markdown
              - b3_quote("PETR4"):             brapi → yfinance → scraping (cascata)
              - favorite_add("PETR4"):         SQLite
            → adiciona tool_result nas mensagens, volta ao passo 1
         3. Se LLM retorna mensagem final → encerra
       ↓
       Frontend renderiza resposta + tool calls (colapsáveis)
```

---

## 3. Fases e SubFases

Cada SubFase termina com `go build ./...` + `pnpm --filter web build` passando e funcionalidade testável manualmente.

| Fase | Título | Esforço | Depende de |
|------|--------|---------|------------|
| **1** | Scaffold do monorepo | 2h | — |
| **2** | Design system Orb Quantum (tokens + primitivos) | 3h | 1 |
| **3A** | Backend: servidor HTTP + SQLite + logger | 2h | 1 |
| **3B** | Backend: config + OpenRouter client | 2h | 3A |
| **4A** | Camada B3: adapter brapi.dev | 2h | 3A |
| **4B** | Camada B3: adapter yfinance + cascata + cache | 3h | 4A |
| **4C** | Camada B3: lista de tickers + categorias | 1h | 4A |
| **5A** | Agente: Query Loop + tool protocol (OpenAI-compat via OpenRouter) | 4h | 3B |
| **5B** | Agente: SSE streaming para o frontend | 2h | 5A |
| **6A** | Tool `web_search` (DuckDuckGo HTML, sem key) | 2h | 5A |
| **6B** | Tool `web_fetch` (readability + sanitização) | 2h | 6A |
| **6C** | Tools B3: `b3_quote`, `b3_fundamentals`, `b3_search_ticker` | 2h | 4B, 5A |
| **7** | Serviço de notícias (scraper + cache 30min) | 3h | 6B |
| **8A** | Frontend: shell + layout (sidebar + chat panel) | 3h | 2 |
| **8B** | Frontend: cliente API + store de chat (SSE) | 2h | 8A, 5B |
| **9** | **Mascote Orb animado** (SVG + CSS + reactive states) | 4h | 2, 8A |
| **10A** | Home: grid de categorias + feed de notícias | 3h | 7, 8A |
| **10B** | Home: chat aberto com mascote | 3h | 8B, 9 |
| **11** | Página de ativo (`/asset/[ticker]`): cotação, fundamentos, notícias, chat contextual | 4h | 10A, 6C |
| **12A** | Favoritos: tool + store + UI (star button) | 2h | 5A, 8A |
| **12B** | Job diário: varredura de notícias dos favoritos | 3h | 7, 12A |
| **13** | Observabilidade + testes (unit + integração) | 4h | todas |
| **14** | Packaging (single binary + embed frontend) | 2h | 13 |

**Total estimado:** ~55h distribuídas em ~20 SubFases entregáveis.

---

## 4. Detalhamento das fases críticas

### Fase 1 — Scaffold do monorepo

**Arquivos a criar:**

| Arquivo | Conteúdo |
|---------|----------|
| `go.work` | workspace com `apps/api` |
| `apps/api/go.mod` | `module github.com/joaopedro/genie/api` · Go 1.23 |
| `apps/api/cmd/genie/main.go` | entrypoint mínimo "hello genie" |
| `package.json` | raiz com workspaces |
| `pnpm-workspace.yaml` | `packages: ['apps/*', 'packages/*']` |
| `apps/web/package.json` | SvelteKit + Vite + TS |
| `packages/shared/package.json` | tipos compartilhados |
| `.gitignore` | node_modules, dist, *.db, .env |
| `.env.example` | `OPENROUTER_API_KEY=`, `PORT=5858`, `DB_PATH=./genie.db` |
| `CHANGELOG.md` | stub inicial |

**Dependências Go (go.mod):**
```go
require (
    github.com/go-chi/chi/v5 v5.1.0
    github.com/go-chi/cors v1.2.1
    modernc.org/sqlite v1.33.0           // driver puro Go, sem CGO
    github.com/mattn/go-readability v0.0.0-latest // readability fallback
    github.com/PuerkitoBio/goquery v1.10.0
    github.com/robfig/cron/v3 v3.0.1
    github.com/joho/godotenv v1.5.1
    github.com/rs/zerolog v1.33.0
)
```

**Dependências web (package.json):**
```json
{
  "devDependencies": {
    "@sveltejs/kit": "^2.5.0",
    "@sveltejs/adapter-static": "^3.0.0",
    "svelte": "^4.2.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

**Teste:** `go run ./apps/api/cmd/genie` responde na porta 5858; `pnpm --filter web dev` abre Vite.

---

### Fase 2 — Design System Orb Quantum

**Arquivo-chave:** `apps/web/src/lib/theme/orb-quantum.css`

Extrair **cssTokens** do design system e transformar em custom properties + utilitários Tailwind-like (mas vanilla CSS, sem dependência extra). Convenção:

```css
:root {
  /* Backgrounds */
  --bg-primary: #050507;
  --bg-surface: #16171C;
  --bg-surface-2: #23242B;
  --bg-elevated: #1C1D24;

  /* Text */
  --text-primary: #EDEBFF;
  --text-secondary: #B7B9C9;
  --text-muted: #8B8D9A;

  /* Accent */
  --accent-gold: #CFC29A;
  --accent-gold-2: #B7A36D;
  --accent-lilac: #A79BFF;
  --accent-violet: #6C42FF;

  /* Status */
  --status-success: #7ED6A7;
  --status-warning: #E8C56A;
  --status-error: #F07C7C;
  --status-info: #8CB8FF;

  /* Radii */
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --radius-xl: 32px;

  /* Shadows */
  --shadow-card: 0 12px 40px rgba(0,0,0,0.38);
  --glow-violet: 0 0 24px rgba(167,155,255,0.35);
  --glow-gold: 0 0 20px rgba(207,194,154,0.22);
  --orb-glow: 0 0 60px rgba(167,155,255,0.28), 0 0 120px rgba(237,235,255,0.12);

  /* Gradients */
  --gradient-brand: linear-gradient(135deg,#CFC29A 0%,#A79BFF 45%,#EDEBFF 70%,#6C42FF 100%);
  --gradient-bg: radial-gradient(circle at center, rgba(167,155,255,0.16) 0%, rgba(5,5,7,0) 45%), linear-gradient(180deg,#050507 0%,#0B0C11 100%);
  --surface-glass: linear-gradient(180deg, rgba(28,29,36,0.88) 0%, rgba(17,18,23,0.92) 100%);

  /* Motion */
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 180ms;
  --dur-medium: 280ms;
  --dur-smooth: 420ms;
  --dur-cinematic: 900ms;
}

html, body { background: var(--gradient-bg); color: var(--text-primary); font-family: 'Inter', system-ui, sans-serif; }
```

**Primitivos a criar em `apps/web/src/lib/components/ui/`:**
- `Button.svelte` (variantes: primary, ghost, danger) — usa `buttonPrimary` do design system
- `Card.svelte` — `technicalCard` (glass + border gold)
- `Input.svelte` — focus ring lilac
- `Badge.svelte` — variantes status
- `Skeleton.svelte` — `animate-pulse` com shimmer lilac

**Tipografia:** carregar `Sora` (display) + `Inter` (body) + `Space Grotesk` (technical/números) via `<link>` no `app.html`.

---

### Fase 4 — Camada B3 (sem API key)

**Estratégia de cascata** em `apps/api/internal/b3/source.go`:

```go
type Quote struct {
    Ticker       string    `json:"ticker"`
    Name         string    `json:"name"`
    Price        float64   `json:"price"`
    ChangePct    float64   `json:"changePct"`
    Volume       int64     `json:"volume"`
    MarketCap    float64   `json:"marketCap"`
    Currency     string    `json:"currency"` // "BRL"
    UpdatedAt    time.Time `json:"updatedAt"`
    Source       string    `json:"source"`   // "brapi" | "yfinance" | "fundamentus"
}

type Source interface {
    Name() string
    Quote(ctx context.Context, ticker string) (*Quote, error)
    Fundamentals(ctx context.Context, ticker string) (*Fundamentals, error)
}

type CascadeSource struct {
    sources []Source // [brapi, yfinance, fundamentusScraper]
    cache   *TTLCache
    breaker *CircuitBreaker // abre após 3 falhas consecutivas por 30s
    log     zerolog.Logger
}

func (c *CascadeSource) Quote(ctx context.Context, ticker string) (*Quote, error) {
    if hit, ok := c.cache.Get("quote:" + ticker); ok { return hit.(*Quote), nil }
    for _, src := range c.sources {
        if c.breaker.IsOpen(src.Name()) { continue }
        q, err := src.Quote(ctx, ticker)
        if err == nil { c.cache.Set("quote:"+ticker, q, 60*time.Second); return q, nil }
        c.log.Warn().Str("source", src.Name()).Err(err).Msg("quote failed, trying next")
        c.breaker.RecordFailure(src.Name())
    }
    return nil, ErrAllSourcesFailed
}
```

**Fontes (ordem):**

1. **brapi.dev** (preferencial) — `https://brapi.dev/api/quote/{TICKER}` gratuito sem key para uso básico (com limite de req/min). Formato JSON direto.
2. **Yahoo Finance unofficial** — `https://query1.finance.yahoo.com/v7/finance/quote?symbols={TICKER}.SA` (tickers brasileiros com sufixo `.SA`). Sem key.
3. **Fundamentus / Status Invest (scraping)** — fallback final via goquery: `https://statusinvest.com.br/acoes/{ticker}` → extrai `[data-main-price]`, P/L, DY, etc.

**Lista de tickers por categoria** (`apps/api/internal/b3/categories.go`): hardcoded inicialmente com os principais (IBOV top ~80), organizados:
- `financeiro`: ITUB4, BBDC4, BBAS3, SANB11, BPAC11
- `commodities`: VALE3, PETR4, PETR3, SUZB3, CSNA3, GGBR4
- `varejo`: MGLU3, LREN3, AMER3, VIIA3, ASAI3
- `energia`: ELET3, ENGI11, EGIE3, CPFE3, TAEE11
- `saneamento`: SBSP3, CSMG3, SAPR11
- `tecnologia`: TOTS3, LWSA3, POSI3
- `saude`: RDOR3, HAPV3, FLRY3

Atualizar dinamicamente (opcional, fase tardia) via scraping da página de composição do IBOV.

---

### Fase 5 — Agente (Query Loop + Tools)

**Protocolo:** OpenRouter é 100% compatível com a API Chat Completions da OpenAI (incluindo `tools` e `tool_calls`). Usar formato OpenAI nativo.

**Arquivo central:** `apps/api/internal/agent/loop.go`

```go
type Tool struct {
    Name        string                                                           // "web_search"
    Description string
    Schema      json.RawMessage                                                  // JSON Schema dos params
    Handler     func(ctx context.Context, raw json.RawMessage) (any, error)
    Concurrent  bool                                                             // pode rodar em paralelo com outras?
}

type QueryLoop struct {
    llm   *openrouter.Client
    tools map[string]Tool
    log   zerolog.Logger
}

func (q *QueryLoop) Run(ctx context.Context, msgs []Message, stream chan<- Event) error {
    for step := 0; step < 20; step++ { // max 20 iterações
        resp, err := q.llm.StreamChat(ctx, ChatRequest{
            Model:    "anthropic/claude-sonnet-4.6", // default, sobrescrevível
            Messages: msgs,
            Tools:    q.toolSchemas(),
            Stream:   true,
        }, stream)
        if err != nil { return err }

        if len(resp.ToolCalls) == 0 {
            msgs = append(msgs, resp.Message)
            return nil // agente terminou
        }

        // Executa tool calls (em paralelo se todos Concurrent)
        results := q.executeTools(ctx, resp.ToolCalls, stream)
        msgs = append(msgs, resp.Message)
        for _, r := range results { msgs = append(msgs, r) }
    }
    return ErrMaxSteps
}
```

**System prompt base** (`apps/api/internal/agent/prompt.go`):

```
Você é Genie, um assistente financeiro brasileiro especializado em B3 (bolsa de valores).
Seu papel é ajudar o usuário a entender ações, FIIs, ETFs e BDRs listados na B3.

Ferramentas disponíveis:
- b3_quote(ticker): cotação atual e variação
- b3_fundamentals(ticker): P/L, DY, ROE, dívida, etc.
- b3_search_ticker(query): busca ticker a partir de nome/setor
- web_search(query): busca notícias recentes na web
- web_fetch(url): lê conteúdo de uma página (notícia, relatório)
- favorite_add(ticker) / favorite_remove(ticker) / favorite_list()

Regras:
1. Sempre que o usuário mencionar uma empresa, busque o ticker e cotação atualizada.
2. Para notícias, use web_search com query focada (ex: "PETR4 notícias 2026") e depois web_fetch nos top 2-3 links relevantes.
3. Cite fontes com link ao mencionar notícias.
4. Nunca dê recomendação de compra/venda sem disclaimer de que não é consultoria de investimento.
5. Responda em português brasileiro, tom profissional mas acessível.
```

**Eventos SSE enviados ao frontend:**
```ts
type Event =
  | { type: 'token', delta: string }
  | { type: 'tool_call_start', id: string, name: string, args: object }
  | { type: 'tool_call_end',   id: string, result: any, durationMs: number }
  | { type: 'message_end',     usage: { tokens: number, cost: number } }
  | { type: 'error',           message: string }
```

---

### Fase 6 — Tools: web_search, web_fetch, b3_*

#### `tools/web_search.go`

Sem API key: fazer GET em `https://html.duckduckgo.com/html/?q={query}` e extrair resultados com goquery.

```go
func WebSearch(ctx context.Context, query string) ([]SearchResult, error) {
    req, _ := http.NewRequestWithContext(ctx, "GET",
        "https://html.duckduckgo.com/html/?q="+url.QueryEscape(query), nil)
    req.Header.Set("User-Agent", "Mozilla/5.0 (Genie/1.0)")
    resp, err := httpClient.Do(req); if err != nil { return nil, err }
    defer resp.Body.Close()

    doc, err := goquery.NewDocumentFromReader(resp.Body); if err != nil { return nil, err }
    var results []SearchResult
    doc.Find(".result").Each(func(i int, s *goquery.Selection) {
        if i >= 10 { return }
        results = append(results, SearchResult{
            Title:   strings.TrimSpace(s.Find(".result__title").Text()),
            URL:     s.Find(".result__url").AttrOr("href", ""),
            Snippet: strings.TrimSpace(s.Find(".result__snippet").Text()),
        })
    })
    return results, nil
}
```

Fallback alternativo: SearXNG público (`https://searx.be/search?q=...&format=json`).

#### `tools/web_fetch.go`

Usa `go-readability` para extrair conteúdo principal, depois converte para markdown simples e trunca em 8000 chars para economia de token.

```go
func WebFetch(ctx context.Context, rawURL string) (*FetchResult, error) {
    // 1. Validação SSRF: bloquear IPs privados (CWE-918)
    if err := validateURL(rawURL); err != nil { return nil, err }

    article, err := readability.FromURL(rawURL, 30*time.Second)
    if err != nil { return nil, err }

    md := htmlToMarkdown(article.Content)
    if len(md) > 8000 { md = md[:8000] + "\n\n[... conteúdo truncado ...]" }

    return &FetchResult{
        URL: rawURL, Title: article.Title, Content: md,
        PublishedAt: article.PublishedTime, Excerpt: article.Excerpt,
    }, nil
}

func validateURL(raw string) error {
    u, err := url.Parse(raw); if err != nil { return err }
    if u.Scheme != "https" && u.Scheme != "http" { return ErrInvalidScheme }
    ips, _ := net.LookupIP(u.Hostname())
    for _, ip := range ips {
        if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
            return ErrSSRFBlocked
        }
    }
    return nil
}
```

#### `tools/b3.go`

Três tools:
- `b3_quote(ticker: string)` → delega para `b3.CascadeSource.Quote`
- `b3_fundamentals(ticker: string)` → idem para `Fundamentals`
- `b3_search_ticker(query: string)` → busca fuzzy na lista estática de tickers

---

### Fase 7 — Serviço de notícias

`apps/api/internal/news/service.go`

```go
type Article struct {
    Title       string
    URL         string
    Source      string    // "InfoMoney", "Valor", "Investing.com"
    PublishedAt time.Time
    Summary     string
    Tickers     []string
    Category    string
}

type NewsService struct {
    cache  *TTLCache  // "news:category:financeiro" → []Article, TTL 30min
    store  *store.DB
    search tools.WebSearch
    fetch  tools.WebFetch
}

func (n *NewsService) ByCategory(ctx context.Context, cat string) ([]Article, error) {
    key := "news:cat:" + cat
    if hit, ok := n.cache.Get(key); ok { return hit.([]Article), nil }

    tickers := categories.TickersFor(cat) // top 3 da categoria
    var out []Article
    for _, t := range tickers {
        results, _ := n.search.Run(ctx, fmt.Sprintf("%s notícias B3 2026", t))
        for _, r := range results[:min(3, len(results))] {
            out = append(out, Article{Title: r.Title, URL: r.URL, Source: extractDomain(r.URL), Tickers: []string{t}, Category: cat})
        }
    }
    n.cache.Set(key, out, 30*time.Minute)
    return out, nil
}

func (n *NewsService) ByTicker(ctx context.Context, ticker string) ([]Article, error) { /* similar */ }
```

**Endpoints REST expostos:**
- `GET /api/news?category=financeiro` → `[]Article`
- `GET /api/news?ticker=PETR4` → `[]Article`

---

### Fase 9 — Mascote Orb animado

**Peça central da marca.** Componente `apps/web/src/lib/components/Orb.svelte`.

**Tecnologia:** SVG + CSS animations + Svelte reactive states (sem Three.js — manter simples).

**Camadas (de fora para dentro):**
1. **Glow externo** (radial-gradient pulse) — `orbBreathing` 900ms infinite
2. **Anel orbital gold** (SVG circle, stroke-dasharray rotacionando) — 8s linear infinite
3. **Núcleo core** (radial gradient branco→lilás→violeta) — `pulseGlow` 420ms
4. **Linhas meridianas** (4 arcos SVG finos em `#EDEBFF` + `#CFC29A`) — shimmer sobre borda
5. **Partículas** (3–5 pontos girando em raio pequeno) — opcional, `animation: orbit`

**Estados reativos (props):**
```svelte
<Orb state="idle" | "listening" | "thinking" | "speaking" | "error" size={240} />
```

| Estado | Comportamento visual |
|--------|---------------------|
| `idle` | respiração lenta, glow violeta 0.3 |
| `listening` | glow pulsa rápido quando usuário digita/fala |
| `thinking` | linhas meridianas aceleram rotação, adiciona shimmer gold |
| `speaking` | glow sincroniza com tokens SSE (increment no pulse a cada token) |
| `error` | tint vermelho-rosado (`#F07C7C`) breve 400ms, volta idle |

**Snippet inicial (estrutura):**

```svelte
<script lang="ts">
  export let state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' = 'idle';
  export let size = 240;
  $: pulseSpeed = state === 'thinking' ? '600ms' : state === 'speaking' ? '300ms' : '900ms';
</script>

<div class="orb" style="--size: {size}px; --pulse: {pulseSpeed}" data-state={state}>
  <div class="glow-outer" />
  <svg viewBox="0 0 200 200" class="orbital">
    <circle cx="100" cy="100" r="92" fill="none" stroke="url(#goldGrad)" stroke-width="0.8"
            stroke-dasharray="6 8" />
    <circle cx="100" cy="100" r="72" fill="none" stroke="#EDEBFF" stroke-width="0.4" opacity="0.6" />
    <ellipse cx="100" cy="100" rx="92" ry="28" fill="none" stroke="#CFC29A" stroke-width="0.5" opacity="0.5" />
    <ellipse cx="100" cy="100" rx="28" ry="92" fill="none" stroke="#A79BFF" stroke-width="0.5" opacity="0.5" />
    <defs>
      <linearGradient id="goldGrad">
        <stop offset="0%" stop-color="#CFC29A" />
        <stop offset="100%" stop-color="#B7A36D" />
      </linearGradient>
    </defs>
  </svg>
  <div class="core" />
</div>

<style>
  .orb { position: relative; width: var(--size); height: var(--size); display: grid; place-items: center; }
  .glow-outer {
    position: absolute; inset: -20%;
    background: radial-gradient(circle, rgba(237,235,255,0.18) 0%, rgba(167,155,255,0.22) 35%, rgba(108,66,255,0.08) 65%, transparent 80%);
    filter: blur(12px);
    animation: breathe 900ms var(--ease-standard) infinite alternate;
  }
  .core {
    position: absolute; width: 60%; height: 60%; border-radius: 50%;
    background: radial-gradient(circle, rgba(237,235,255,0.95) 0%, rgba(167,155,255,0.65) 35%, rgba(108,66,255,0.18) 65%, rgba(5,5,7,0) 100%);
    box-shadow: var(--orb-glow);
    animation: pulse var(--pulse) ease-in-out infinite alternate;
  }
  .orbital { position: absolute; inset: 0; animation: rotate 18s linear infinite; }
  [data-state="thinking"] .orbital { animation-duration: 6s; }
  [data-state="error"] .core { filter: hue-rotate(-40deg); }
  @keyframes breathe { from { transform: scale(1); opacity: 0.85 } to { transform: scale(1.06); opacity: 1 } }
  @keyframes pulse   { from { transform: scale(0.96) } to { transform: scale(1.04) } }
  @keyframes rotate  { to { transform: rotate(360deg) } }
</style>
```

**Posicionamento:** na home, o Orb fica como **hero central** (480px) acima do chat input. Em páginas internas, vira um mini-orb (64px) no header como avatar do assistente.

---

### Fase 10 — Home page

**Layout (`apps/web/src/routes/+page.svelte`):**

```
┌─────────────────────────────────────────────────────────┐
│ [Genie]                                  [⭐ Favoritos] │
│                                                         │
│               (                                         │
│                   ORB HERO ANIMADO                      │
│                                                         │
│        "Pergunte sobre qualquer ação da B3"             │
│                                                         │
│   ╭─────────────────────────────────────────────────╮   │
│   │ Ex: "Como está a Petrobras hoje?"         [➤]  │   │
│   ╰─────────────────────────────────────────────────╯   │
│                                                         │
│  ─────────── Notícias por categoria ───────────         │
│                                                         │
│  [Financeiro] [Commodities] [Varejo] [Energia] [+]      │
│                                                         │
│  ┌──Card──────┐ ┌──Card──────┐ ┌──Card──────┐           │
│  │ PETR4      │ │ VALE3      │ │ ITUB4      │           │
│  │ R$ 38,12   │ │ R$ 58,90   │ │ R$ 33,45   │           │
│  │ +1,2% 📈   │ │ -0,8% 📉   │ │ +0,3%      │           │
│  │            │ │            │ │            │           │
│  │ Notícias:  │ │ ...        │ │ ...        │           │
│  │ • Título 1 │ │            │ │            │           │
│  │ • Título 2 │ │            │ │            │           │
│  └────────────┘ └────────────┘ └────────────┘           │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- `Orb.svelte` no hero
- `ChatInput.svelte` conectado a store `chatStore` (Svelte store)
- `CategoryTabs.svelte` (pills com gold outline quando ativo)
- `AssetNewsCard.svelte` (cotação + top 3 notícias)

Ao enviar mensagem no input: navega para `/chat/new` OU expande um painel de chat sobre o hero (decisão: overlay modal estilo spotlight, com o Orb se movendo para o topo e o histórico aparecendo abaixo).

---

### Fase 11 — Página de ativo

`/asset/[ticker]/+page.svelte`:

- Header: ticker + nome + ⭐ favoritar + cotação grande + variação dia/semana/mês/ano
- Tabs: **Resumo** | **Fundamentos** | **Notícias** | **Chat**
- Tab Chat: conversation pré-populada com contexto `{ ticker }` injetado no system prompt
- Tab Fundamentos: P/L, DY, ROE, dívida/patrimônio, margens (tabela com sparkline)

---

### Fase 12 — Favoritos + job diário

**Schema SQLite (`apps/api/internal/store/migrations/001_init.sql`):**

```sql
CREATE TABLE favorites (
    ticker       TEXT PRIMARY KEY,
    added_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_news_at DATETIME
);
CREATE TABLE news_cache (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker       TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    source       TEXT,
    summary      TEXT,
    published_at DATETIME,
    fetched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_news_ticker ON news_cache(ticker, published_at DESC);

CREATE TABLE conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL, -- user|assistant|tool
    content         TEXT NOT NULL, -- JSON
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Job diário (`apps/api/internal/jobs/daily_favorites.go`):**

```go
func (j *Jobs) Start() {
    c := cron.New(cron.WithLocation(time.FixedZone("BRT", -3*3600)))
    c.AddFunc("0 8 * * 1-5", j.RefreshFavoritesNews) // 08:00 dias úteis
    c.Start()
}

func (j *Jobs) RefreshFavoritesNews(ctx context.Context) {
    favs, _ := j.store.ListFavorites(ctx)
    for _, f := range favs {
        articles, err := j.news.ByTicker(ctx, f.Ticker)
        if err != nil { j.log.Error().Err(err).Str("ticker", f.Ticker).Send(); continue }
        j.store.UpsertNews(ctx, f.Ticker, articles)
        j.store.UpdateFavoriteLastNewsAt(ctx, f.Ticker, time.Now())
    }
}
```

**UI:** página `/favorites` com lista de ações favoritadas + contador "X novas notícias desde ontem" + botão "Atualizar agora".

---

## 5. Segurança (aderência aos princípios 3 e 7)

| Risco | Mitigação |
|-------|-----------|
| **SSRF (CWE-918)** em `web_fetch` | Bloquear IPs privados/loopback, whitelist de schemas http/https, timeout 30s |
| **Prompt injection** via conteúdo web | Já existe sanitizer de queries no projeto (ver essential-story). Aplicar em inputs de chat e também em resultados de `web_fetch` antes de passar para LLM: strip de instruções no formato "ignore previous" |
| **Command Injection** | Nenhum uso de `exec.Command` com user input; scraping apenas via HTTP |
| **SQLi** | Drizzle-equivalent em Go: `database/sql` com `?` placeholders sempre |
| **XSS no frontend** | Svelte por default escapa; nunca usar `{@html}` com dado remoto sem DOMPurify |
| **API key OpenRouter** | Armazenar **apenas no backend** via `.env`; nunca expor ao frontend |
| **Rate limit** | Middleware em `/api/chat/*`: 30 req/min por IP local |
| **Logs seguros** | Nunca logar `OPENROUTER_API_KEY`, mascarar tokens em messages |

---

## 6. Observabilidade (princípio 8)

- **Logger:** zerolog com campos estruturados (`ticker`, `conversationId`, `tool`, `durationMs`, `source`).
- **Request log middleware**: method, path, status, duration.
- **Trace de query loop**: cada iteração logada com `step`, `tool_calls_count`, `tokens_in`, `tokens_out`.
- **Métricas** (fase 13): expor `/metrics` Prometheus-compat (latência por tool, hit rate do cache, erros por fonte B3).

---

## 7. Testes (princípio 6)

**Pirâmide:**
- **Unit (Go, testing):** adapters B3 (mock HTTP com `httptest`), parsers de notícia, circuit breaker, TTL cache. Alvo: >80% em `internal/b3`, `internal/tools`, `internal/news`.
- **Integration:** query loop end-to-end com fake OpenRouter (replay de gravações JSON).
- **Frontend unit (Vitest):** stores, formatters (formatCurrency, formatPct).
- **E2E (Playwright, fase 14):** fluxo "abre home → digita pergunta → vê resposta com tool calls → favorita ação".

---

## 8. Variáveis de ambiente

`.env.example`:
```env
# Obrigatório
OPENROUTER_API_KEY=sk-or-v1-...

# Opcional
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # default
PORT=5858
DB_PATH=./genie.db
LOG_LEVEL=info                                  # debug|info|warn|error
NEWS_CACHE_TTL_MINUTES=30
QUOTE_CACHE_TTL_SECONDS=60
BRAPI_TOKEN=                                    # opcional, aumenta rate limit
```

---

## 9. Critérios de conclusão (Definition of Done global)

- [ ] `go build ./...` + `pnpm build` passam sem erro
- [ ] `go test ./...` com coverage ≥ 70%
- [ ] Home mostra notícias das 6 categorias principais
- [ ] Chat funciona com streaming SSE e exibe tool calls colapsados
- [ ] Mascote Orb anima nos 5 estados
- [ ] Favoritar persiste em SQLite e aparece em `/favorites`
- [ ] Job diário configurado (testável manualmente via endpoint admin `POST /api/admin/jobs/refresh-favorites`)
- [ ] Consulta "Como está a Petrobras?" retorna cotação atualizada + 2-3 notícias com fontes
- [ ] Funciona offline para dados em cache (fallback graceful se rede cai)
- [ ] CHANGELOG.md atualizado por SubFase

---

## 10. Roadmap pós-v1 (fora do escopo)

- Voz: STT (Whisper) + TTS (ElevenLabs) para o mascote falar
- Multi-usuário com auth JWT
- Carteira virtual simulada com P&L
- Alertas por preço / evento corporativo
- Integração WhatsApp para receber notícias dos favoritos
- App desktop via Wails (Go + Svelte empacotado nativo)

---

## 11. Próximos passos imediatos

1. ✅ **Plano aprovado** (este documento)
2. **Fase 1** — scaffold do monorepo (criar estrutura de pastas, go.work, package.json, SvelteKit init, `main.go` hello world)
3. **Fase 2** — colar tokens CSS do Orb Quantum + criar `Button`, `Card`, `Input`, `Badge`
4. **Fase 3A/3B** — subir servidor Go com SQLite + cliente OpenRouter testado

Cada SubFase terá seu próprio plano curto em `docs/plans/XX-nome.md` quando for complexa, conforme regra do CLAUDE.md.
