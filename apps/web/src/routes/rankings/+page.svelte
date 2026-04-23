<script lang="ts">
  import { onMount } from 'svelte';
  import { TrendingUp, TrendingDown, Minus, Newspaper, Search, Star, Loader2, X } from 'lucide-svelte';
  import { apiClient } from '$lib/api/client';
  import CategoryTabs from '$lib/components/home/CategoryTabs.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import { ALL_CATEGORIES } from '@genie/shared';
  import type { Category, Article, Quote } from '@genie/shared';

  // Fallback: top 5 tickers per category when DB has no articles yet
  const FALLBACK_TICKERS: Record<Category, string[]> = {
    financeiro:  ['ITUB4', 'BBDC4', 'BBAS3', 'SANB11', 'BPAC11'],
    commodities: ['VALE3', 'PETR4', 'SUZB3', 'PRIO3', 'GGBR4'],
    varejo:      ['MGLU3', 'LREN3', 'ASAI3', 'PCAR3', 'CRFB3'],
    energia:     ['ELET3', 'ENGI11', 'EGIE3', 'CPFE3', 'CMIG4'],
    saneamento:  ['SBSP3', 'CSMG3', 'SAPR11', 'SAPR4', 'SAPR3'],
    tecnologia:  ['TOTS3', 'TIMS3', 'VIVT3', 'POSI3', 'CASH3'],
    saude:       ['RDOR3', 'HAPV3', 'FLRY3', 'DASA3', 'BLAU3'],
  };

  type LoadState = 'idle' | 'loading' | 'success' | 'error';

  interface RankedAsset {
    ticker: string;
    mentions: number;
    quote: Quote | null;
  }

  let activeCategory: Category = 'financeiro';
  let state: LoadState = 'idle';
  let errorMsg = '';
  let rankings: RankedAsset[] = [];

  // Favorites set for O(1) lookups
  let favoriteTickers = new Set<string>();
  let favPending = new Set<string>(); // tickers with in-flight fav requests

  // Search state
  let searchQuery = '';
  let searchResult: RankedAsset | null = null;
  let searchState: 'idle' | 'loading' | 'notfound' | 'error' | 'done' = 'idle';
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // Per-category cache
  const cache = new Map<Category, RankedAsset[]>();

  async function load(cat: Category) {
    if (cache.has(cat)) {
      rankings = cache.get(cat)!;
      state = 'success';
      return;
    }

    state = 'loading';
    errorMsg = '';

    try {
      const articles: Article[] = await apiClient.getNewsByCategory(cat, 200);
      let topTickers = aggregateTickers(articles);

      // When DB has no articles for this category, use curated fallback tickers
      if (topTickers.length === 0) {
        topTickers = (FALLBACK_TICKERS[cat] ?? []).map(ticker => ({ ticker, mentions: 0 }));
      }

      const quotes = await Promise.allSettled(
        topTickers.map((t) => apiClient.getQuote(t.ticker))
      );

      const allRankings = topTickers.map((t, i) => ({
        ticker: t.ticker,
        mentions: t.mentions,
        quote: quotes[i].status === 'fulfilled' ? quotes[i].value : null,
      }));

      // Prioritize tickers with quotes; pad with fallbacks if needed
      const withQuote = allRankings.filter(r => r.quote !== null);
      if (withQuote.length >= 5) {
        rankings = withQuote.slice(0, 5);
      } else {
        // Not enough tickers with quotes — pad from fallback list
        const existing = new Set(allRankings.map(r => r.ticker));
        const fallbacks = (FALLBACK_TICKERS[cat] ?? [])
          .filter(t => !existing.has(t))
          .slice(0, 5 - withQuote.length);
        const fallbackQuotes = await Promise.allSettled(fallbacks.map(t => apiClient.getQuote(t)));
        const fallbackRankings = fallbacks.map((t, i) => ({
          ticker: t,
          mentions: 0,
          quote: fallbackQuotes[i].status === 'fulfilled' ? fallbackQuotes[i].value : null,
        })).filter(r => r.quote !== null);
        rankings = [...withQuote, ...fallbackRankings].slice(0, 5);
      }

      cache.set(cat, rankings);
      state = 'success';
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      state = 'error';
    }
  }

  async function loadFavorites() {
    try {
      const favs = await apiClient.getFavorites();
      favoriteTickers = new Set(favs.map((f) => f.ticker));
    } catch {
      // non-fatal
    }
  }

  async function toggleFavorite(ticker: string, event?: MouseEvent | KeyboardEvent) {
    // Quando o botão de favorito está dentro de um <a>, precisamos impedir
    // a navegação para /asset/[ticker] que aconteceria de qualquer outro clique.
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (favPending.has(ticker)) return;
    favPending = new Set(favPending).add(ticker);

    try {
      if (favoriteTickers.has(ticker)) {
        await apiClient.removeFavorite(ticker);
        favoriteTickers = new Set([...favoriteTickers].filter((t) => t !== ticker));
      } else {
        await apiClient.addFavorite(ticker);
        favoriteTickers = new Set([...favoriteTickers, ticker]);
      }
    } catch {
      // ignore — visual state stays as-is
    } finally {
      const next = new Set(favPending);
      next.delete(ticker);
      favPending = next;
    }
  }

  function aggregateTickers(articles: Article[]): { ticker: string; mentions: number }[] {
    const map = new Map<string, number>();
    for (const art of articles) {
      for (const ticker of art.tickers ?? []) {
        if (!ticker) continue;
        map.set(ticker, (map.get(ticker) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([ticker, mentions]) => ({ ticker, mentions }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 5);
  }

  function onSearchInput() {
    if (searchDebounce) clearTimeout(searchDebounce);
    const q = searchQuery.trim().toUpperCase();
    if (!q) {
      searchState = 'idle';
      searchResult = null;
      return;
    }
    searchDebounce = setTimeout(() => doSearch(q), 400);
  }

  async function doSearch(ticker: string) {
    searchState = 'loading';
    searchResult = null;
    try {
      const quote = await apiClient.getQuote(ticker);
      searchResult = { ticker, mentions: 0, quote };
      searchState = 'done';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      searchState = msg.toLowerCase().includes('not found') ? 'notfound' : 'error';
    }
  }

  function clearSearch() {
    searchQuery = '';
    searchResult = null;
    searchState = 'idle';
    if (searchDebounce) clearTimeout(searchDebounce);
  }

  function medal(pos: number): string {
    if (pos === 0) return '🥇';
    if (pos === 1) return '🥈';
    if (pos === 2) return '🥉';
    return String(pos + 1);
  }

  function formatPrice(q: Quote | null): string {
    if (!q) return '—';
    return q.price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: q.currency ?? 'BRL',
      minimumFractionDigits: 2,
    });
  }

  function formatChange(q: Quote | null): string {
    if (!q) return '';
    const sign = q.changePct >= 0 ? '+' : '';
    return `${sign}${q.changePct.toFixed(2)}%`;
  }

  $: load(activeCategory);
  onMount(() => {
    load(activeCategory);
    loadFavorites();
  });
</script>

<svelte:head>
  <title>Rankings B3 — Genie</title>
  <meta name="description" content="Ranking dos ativos B3 mais comentados nas notícias por setor. Veja cotação e variação dos líderes de cada categoria." />
  <meta property="og:title" content="Rankings B3 — Genie" />
  <meta property="og:description" content="Ranking dos ativos B3 mais comentados nas notícias por setor." />
</svelte:head>

<main class="page">
  <div class="page__header">
    <div class="page__title-row">
      <TrendingUp size={24} aria-hidden="true" />
      <h1 class="page__title">Rankings</h1>
    </div>
    <p class="page__subtitle">Os ativos mais comentados nas notícias por categoria, com cotação em tempo real.</p>
  </div>

  <!-- Search bar -->
  <div class="search-wrap">
    <div class="search-box" class:search-box--active={searchQuery.length > 0}>
      <Search size={15} class="search-box__icon" aria-hidden="true" />
      <input
        class="search-box__input"
        type="text"
        placeholder="Buscar ativo fora do ranking… ex: VALE3"
        bind:value={searchQuery}
        on:input={onSearchInput}
        aria-label="Buscar ativo B3"
        autocomplete="off"
        spellcheck="false"
      />
      {#if searchQuery}
        <button class="search-box__clear" on:click={clearSearch} aria-label="Limpar busca">
          <X size={13} />
        </button>
      {/if}
    </div>

    {#if searchState === 'loading'}
      <div class="search-result search-result--loading">
        <Loader2 size={16} class="spin" />
        <span>Buscando {searchQuery.trim().toUpperCase()}…</span>
      </div>
    {:else if searchState === 'notfound'}
      <div class="search-result search-result--empty">
        Ativo <strong>{searchQuery.trim().toUpperCase()}</strong> não encontrado.
      </div>
    {:else if searchState === 'error'}
      <div class="search-result search-result--empty">
        Erro ao buscar. Verifique o ticker e tente novamente.
      </div>
    {:else if searchState === 'done' && searchResult}
      {@const r = searchResult}
      {@const change = r.quote?.changePct ?? null}
      {@const positive = change !== null && change > 0}
      {@const negative = change !== null && change < 0}
      {@const isFav = favoriteTickers.has(r.ticker)}
      {@const isPending = favPending.has(r.ticker)}
      <div class="search-result">
        <a class="rank-card rank-card--search" href="/asset/{r.ticker}" aria-label="Abrir análise de {r.ticker}">
          <span class="rank-card__pos" aria-label="Resultado de busca">
            <Search size={14} />
          </span>

          <div class="rank-card__body">
            <div class="rank-card__ticker">{r.ticker}</div>
            {#if r.quote?.name}
              <div class="rank-card__name">{r.quote.name}</div>
            {/if}
          </div>

          <div class="rank-card__right">
            <div class="rank-card__price">{formatPrice(r.quote)}</div>
            {#if change !== null}
              <div
                class="rank-card__change"
                class:rank-card__change--up={positive}
                class:rank-card__change--down={negative}
              >
                {#if positive}
                  <TrendingUp size={12} aria-hidden="true" />
                {:else if negative}
                  <TrendingDown size={12} aria-hidden="true" />
                {:else}
                  <Minus size={12} aria-hidden="true" />
                {/if}
                {formatChange(r.quote)}
              </div>
            {/if}
          </div>

          <button
            class="fav-btn"
            class:fav-btn--active={isFav}
            class:fav-btn--pending={isPending}
            on:click={(e) => toggleFavorite(r.ticker, e)}
            aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            disabled={isPending}
          >
            {#if isPending}
              <Loader2 size={14} class="spin" />
            {:else}
              <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
            {/if}
          </button>
        </a>
      </div>
    {/if}
  </div>

  <CategoryTabs
    categories={ALL_CATEGORIES}
    bind:active={activeCategory}
    on:change={(e) => { activeCategory = e.detail; cache.delete(e.detail); }}
  />

  <div class="rankings">
    {#if state === 'loading' || state === 'idle'}
      <div class="rankings__list">
        {#each { length: 5 } as _, i}
          <div class="rank-card rank-card--skeleton">
            <span class="rank-card__pos">{i + 1}</span>
            <div class="rank-card__body">
              <Skeleton height="16px" width="80px" rounded="sm" />
              <Skeleton height="13px" width="140px" rounded="sm" />
            </div>
            <div class="rank-card__right">
              <Skeleton height="18px" width="80px" rounded="sm" />
              <Skeleton height="13px" width="52px" rounded="sm" />
            </div>
            <div style="width:28px" />
          </div>
        {/each}
      </div>

    {:else if state === 'error'}
      <div class="rankings__error" role="alert">
        <p>{errorMsg}</p>
        <button class="rankings__retry" on:click={() => { cache.delete(activeCategory); load(activeCategory); }}>
          Tentar novamente
        </button>
      </div>

    {:else if rankings.length === 0}
      <div class="rankings__empty">
        <Newspaper size={40} aria-hidden="true" />
        <p>Nenhum dado disponível para esta categoria.</p>
      </div>

    {:else}
      <div class="rankings__list">
        {#each rankings as rank, i (rank.ticker)}
          {@const change = rank.quote?.changePct ?? null}
          {@const positive = change !== null && change > 0}
          {@const negative = change !== null && change < 0}
          {@const isFav = favoriteTickers.has(rank.ticker)}
          {@const isPending = favPending.has(rank.ticker)}
          <a
            class="rank-card"
            class:rank-card--gold={i === 0}
            class:rank-card--silver={i === 1}
            class:rank-card--bronze={i === 2}
            href="/asset/{rank.ticker}"
            aria-label="Abrir análise de {rank.ticker}"
          >
            <span class="rank-card__pos" aria-label="Posição {i + 1}">
              {medal(i)}
            </span>

            <div class="rank-card__body">
              <div class="rank-card__ticker">{rank.ticker}</div>
              {#if rank.quote?.name}
                <div class="rank-card__name">{rank.quote.name}</div>
              {/if}
              <div class="rank-card__mentions">{rank.mentions} menç{rank.mentions === 1 ? 'ão' : 'ões'} em notícias</div>
            </div>

            <div class="rank-card__right">
              {#if rank.quote}
                <div class="rank-card__price">{formatPrice(rank.quote)}</div>
                {#if change !== null}
                  <div
                    class="rank-card__change"
                    class:rank-card__change--up={positive}
                    class:rank-card__change--down={negative}
                  >
                    {#if positive}
                      <TrendingUp size={12} aria-hidden="true" />
                    {:else if negative}
                      <TrendingDown size={12} aria-hidden="true" />
                    {:else}
                      <Minus size={12} aria-hidden="true" />
                    {/if}
                    {formatChange(rank.quote)}
                  </div>
                {/if}
              {:else}
                <span class="rank-card__no-data">sem cotação</span>
              {/if}
            </div>

            <button
              class="fav-btn"
              class:fav-btn--active={isFav}
              class:fav-btn--pending={isPending}
              on:click={(e) => toggleFavorite(rank.ticker, e)}
              aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              disabled={isPending}
            >
              {#if isPending}
                <Loader2 size={14} class="spin" />
              {:else}
                <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
              {/if}
            </button>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .page {
    padding: var(--space-3xl) var(--space-xl);
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    overflow-x: hidden;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }

  .page__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .page__title-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--accent-lilac);
  }

  .page__title {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }

  .page__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
  }

  /* ── Search ─────────────────────────────────────────── */
  .search-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 var(--space-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    height: 44px;
    transition: border-color var(--dur-fast) var(--ease-standard),
                box-shadow var(--dur-fast) var(--ease-standard);
  }

  .search-box:focus-within,
  .search-box--active {
    border-color: var(--accent-lilac);
    box-shadow: 0 0 0 2px rgba(108, 66, 255, 0.12);
  }

  .search-box :global(.search-box__icon) {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .search-box__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  .search-box__input::placeholder {
    color: var(--text-muted);
    font-family: var(--font-body);
    letter-spacing: 0;
    font-size: var(--text-caption);
  }

  .search-box__clear {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0;
    transition: color var(--dur-fast) var(--ease-standard);
  }

  .search-box__clear:hover {
    color: var(--text-primary);
  }

  .search-result {
    animation: fadeIn 0.15s ease-out;
  }

  .search-result--loading,
  .search-result--empty {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
  }

  /* ── List ───────────────────────────────────────────── */
  .rankings__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* ── Rank card ──────────────────────────────────────── */
  .rank-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      transform var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
  }

  .rank-card:focus-visible {
    outline: 2px solid var(--accent-lilac);
    outline-offset: 2px;
  }

  .rank-card:not(.rank-card--skeleton):not(.rank-card--search):hover {
    background: var(--glass-white);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .rank-card--search {
    border-color: rgba(108, 66, 255, 0.3);
    background: rgba(108, 66, 255, 0.04);
  }

  .rank-card--skeleton {
    pointer-events: none;
  }

  .rank-card--gold   { border-color: rgba(255, 199, 44, 0.35); }
  .rank-card--silver { border-color: rgba(180, 190, 200, 0.35); }
  .rank-card--bronze { border-color: rgba(180, 130, 70, 0.35); }

  /* ── Position ───────────────────────────────────────── */
  .rank-card__pos {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-technical);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
  }

  /* ── Body ───────────────────────────────────────────── */
  .rank-card__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rank-card__ticker {
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    font-weight: 700;
    color: var(--accent-gold);
    letter-spacing: 0.04em;
  }

  .rank-card__name {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rank-card__mentions {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
  }

  /* ── Right (price + change) ─────────────────────────── */
  .rank-card__right {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    min-width: 90px;
  }

  .rank-card__price {
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .rank-card__no-data {
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    color: var(--text-muted);
    opacity: 0.6;
    font-style: italic;
    white-space: nowrap;
  }

  .rank-card__change {
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    font-weight: 600;
    color: var(--text-muted);
  }

  .rank-card__change--up   { color: var(--status-success, #4ADE80); }
  .rank-card__change--down { color: var(--status-error, #F07C7C); }

  /* ── Favorite button ────────────────────────────────── */
  .fav-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    transition:
      color var(--dur-fast) var(--ease-standard),
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard);
  }

  .fav-btn:hover:not(:disabled) {
    color: var(--accent-gold);
    background: rgba(255, 199, 44, 0.08);
    border-color: rgba(255, 199, 44, 0.25);
  }

  .fav-btn--active {
    color: var(--accent-gold);
  }

  .fav-btn--pending {
    opacity: 0.6;
    cursor: default;
  }

  /* ── Empty / error ──────────────────────────────────── */
  .rankings__empty,
  .rankings__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-3xl);
    color: var(--text-muted);
    text-align: center;
  }

  .rankings__retry {
    padding: var(--space-sm) var(--space-xl);
    background: rgba(240, 124, 124, 0.08);
    border: 1px solid rgba(240, 124, 124, 0.4);
    border-radius: var(--radius-md);
    color: var(--status-error);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    cursor: pointer;
  }

  .rankings__retry:hover {
    background: rgba(240, 124, 124, 0.14);
  }

  /* ── Animations ─────────────────────────────────────── */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  :global(.spin) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .page {
      padding: var(--space-md) var(--space-md) var(--space-4xl);
    }

    /* Subtitle: allow wrapping, never clip */
    .page__subtitle {
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* Cards: reduce price column width and hide name to fit narrow screens */
    .rank-card {
      padding: var(--space-md);
      gap: var(--space-sm);
    }

    .rank-card__name {
      display: none;
    }

    .rank-card__right {
      min-width: 68px;
    }

    .rank-card__price {
      font-size: 13px;
    }
  }
</style>
