<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, Search,
    Target, ShieldAlert, Clock,
  } from 'lucide-svelte';
  import { apiClient } from '$lib/api/client';
  import type { PredictionsResponse } from '@genie/shared';
  import PredictionCard from '$lib/components/analysis/PredictionCard.svelte';

  type Tab = 'buy' | 'sell' | 'all';

  let data: PredictionsResponse | null = null;
  let loading = true;
  let error = '';
  let refreshing = false;
  let activeTab: Tab = 'buy';

  // Search
  let searchQuery = '';
  let searching = false;
  let searchError = '';

  onMount(load);

  async function load() {
    loading = true;
    error = '';
    try {
      data = await apiClient.getPredictions();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Falha ao carregar predições.';
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    refreshing = true;
    try {
      data = await apiClient.getPredictions();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Falha ao atualizar.';
    } finally {
      refreshing = false;
    }
  }

  async function submitSearch() {
    const ticker = searchQuery.trim().toUpperCase();
    if (!ticker) return;
    searching = true;
    searchError = '';
    try {
      // A rota já triggerizará análise on-demand se não tiver cache
      await apiClient.getPrediction(ticker);
      goto(`/analise/${ticker}`);
    } catch (err) {
      searchError = err instanceof Error ? err.message : 'Ticker não encontrado.';
      searching = false;
    }
  }

  function formatLastRun(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  $: visibleItems = !data ? [] : activeTab === 'buy' ? data.topBuy : activeTab === 'sell' ? data.topSell : data.all.slice(0, 20);

  $: globalAccuracy = (() => {
    if (!data || data.all.length === 0) return null;
    const entries = data.all.filter(p => p.backtestAccuracy != null && p.backtestTotal! > 0);
    if (entries.length === 0) return null;
    const weightedSum = entries.reduce((s, p) => s + p.backtestAccuracy! * p.backtestTotal!, 0);
    const totalN = entries.reduce((s, p) => s + p.backtestTotal!, 0);
    return Math.round((weightedSum / totalN) * 10) / 10;
  })();
</script>

<svelte:head>
  <title>Predições IA — Genie</title>
</svelte:head>

<main class="predictions-page">
  <!-- ── Header ──────────────────────────────────────── -->
  <header class="predictions-header">
    <div class="predictions-header__left">
      <div class="predictions-header__icon" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <div>
        <h1 class="predictions-header__title">Predições IA</h1>
        <p class="predictions-header__subtitle">Análise quantitativa de ativos da B3 com IA</p>
      </div>
    </div>

    <button class="refresh-btn" on:click={refresh} disabled={refreshing} aria-label="Atualizar predições">
      <RefreshCw size={14} class={refreshing ? 'spin' : ''} />
      {refreshing ? 'Atualizando...' : 'Atualizar'}
    </button>
  </header>

  <!-- ── Busca manual ────────────────────────────────── -->
  <form class="search-form" on:submit|preventDefault={submitSearch}>
    <div class="search-form__wrap">
      <Search size={16} class="search-form__icon" />
      <input
        type="text"
        class="search-form__input"
        placeholder="Analisar outro ticker (ex: WEGE3, BBAS3)"
        bind:value={searchQuery}
        disabled={searching}
        maxlength="10"
      />
      <button
        type="submit"
        class="search-form__btn"
        disabled={searching || !searchQuery.trim()}
      >
        {searching ? 'Analisando...' : 'Analisar'}
      </button>
    </div>
    {#if searchError}
      <p class="search-form__error" role="alert">{searchError}</p>
    {/if}
  </form>

  <!-- ── Stats bar ───────────────────────────────────── -->
  {#if data && data.totalAnalysed > 0}
    <div class="stats-row">
      <div class="stat-card">
        <Target size={14} />
        <span class="stat-label">Acertividade (60d)</span>
        <strong class="stat-value">
          {globalAccuracy != null ? `${globalAccuracy.toFixed(1)}%` : '—'}
        </strong>
      </div>
      <div class="stat-card">
        <Sparkles size={14} />
        <span class="stat-label">Ativos analisados</span>
        <strong class="stat-value">{data.totalAnalysed}</strong>
      </div>
      <div class="stat-card">
        <Clock size={14} />
        <span class="stat-label">Última atualização</span>
        <strong class="stat-value stat-value--sm">{formatLastRun(data.lastRunAt)}</strong>
      </div>
    </div>
  {/if}

  <!-- ── Tabs ────────────────────────────────────────── -->
  {#if data}
    <nav class="tabs" role="tablist">
      <button
        class="tab"
        class:tab--active={activeTab === 'buy'}
        role="tab"
        aria-selected={activeTab === 'buy'}
        on:click={() => (activeTab = 'buy')}
      >
        <TrendingUp size={14} />
        Top 5 Compra
        {#if data.topBuy.length}<span class="tab__badge tab__badge--buy">{data.topBuy.length}</span>{/if}
      </button>
      <button
        class="tab"
        class:tab--active={activeTab === 'sell'}
        role="tab"
        aria-selected={activeTab === 'sell'}
        on:click={() => (activeTab = 'sell')}
      >
        <TrendingDown size={14} />
        Top 5 Venda
        {#if data.topSell.length}<span class="tab__badge tab__badge--sell">{data.topSell.length}</span>{/if}
      </button>
      <button
        class="tab"
        class:tab--active={activeTab === 'all'}
        role="tab"
        aria-selected={activeTab === 'all'}
        on:click={() => (activeTab = 'all')}
      >
        <Minus size={14} />
        Todas
      </button>
    </nav>
  {/if}

  <!-- ── Body ────────────────────────────────────────── -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-orb"></div>
      <p>Carregando predições…</p>
    </div>
  {:else if error}
    <div class="error-state" role="alert">
      <p>{error}</p>
      <button class="retry-btn" on:click={load}>Tentar novamente</button>
    </div>
  {:else if !data || data.totalAnalysed === 0}
    <div class="empty-state">
      <Sparkles size={32} />
      <p class="empty-state__msg">{data?.message ?? 'Nenhuma predição disponível ainda.'}</p>
      <p class="empty-state__hint">As predições são atualizadas automaticamente às 10:15 e 13:15 BRT em dias úteis.</p>
    </div>
  {:else if visibleItems.length === 0}
    <div class="empty-state">
      <p class="empty-state__msg">
        {#if activeTab === 'buy'}Nenhum sinal de compra forte no momento.{:else if activeTab === 'sell'}Nenhum sinal de venda forte no momento.{:else}Sem predições.{/if}
      </p>
      <p class="empty-state__hint">O sistema só emite sinais quando há confluência de pelo menos 2 indicadores — prioriza qualidade sobre quantidade.</p>
    </div>
  {:else}
    <section class="cards-grid">
      {#each visibleItems as item (item.id)}
        <PredictionCard {item} />
      {/each}
    </section>
  {/if}

  <!-- ── Metodologia ─────────────────────────────────── -->
  <section class="methodology">
    <h2 class="section-title">Como funciona</h2>
    <div class="methodology__grid">
      <div class="methodology__item">
        <strong>1. Score quantitativo</strong>
        <p>Cada ativo recebe votos (-1/0/+1) de 6 indicadores técnicos: RSI, MACD, médias móveis, Bollinger, volume relativo e tendência do IBOV. Score total varia de -6 a +6.</p>
      </div>
      <div class="methodology__item">
        <strong>2. Filtro de confluência</strong>
        <p>Só emitimos "compra forte" se score ≥ +4 (pelo menos 4 indicadores concordam). "Venda forte" se ≤ -4. Resto é considerado inconclusivo e não aparece como recomendação.</p>
      </div>
      <div class="methodology__item">
        <strong>3. Backtest walk-forward</strong>
        <p>Para cada ativo, simulamos o mesmo score em cada um dos últimos 60 dias e verificamos se a direção estava correta 5 dias depois. A acertividade é reportada honestamente.</p>
      </div>
      <div class="methodology__item">
        <strong>4. Análise qualitativa IA</strong>
        <p>Ao clicar em um ativo, a página de análise complementa com resumo em linguagem natural de um modelo LLM considerando notícias recentes e fundamentos.</p>
      </div>
    </div>
  </section>

  <!-- ── Disclaimer ──────────────────────────────────── -->
  <div class="disclaimer" role="note">
    <ShieldAlert size={16} />
    <p>
      <strong>Aviso:</strong> as predições são análises quantitativas automatizadas baseadas em indicadores técnicos e não constituem recomendação de investimento. A acertividade histórica não garante resultados futuros. Investir envolve risco de perda, inclusive do capital total. Consulte um analista credenciado pela CVM antes de decidir.
    </p>
  </div>
</main>

<style>
  .predictions-page {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-xl) var(--space-xl) var(--space-5xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  @media (max-width: 768px) {
    .predictions-page {
      padding: calc(env(safe-area-inset-top, 0) + var(--space-md)) var(--space-md) var(--space-4xl);
    }
  }

  /* ── Header ─── */
  .predictions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .predictions-header__left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .predictions-header__icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    border-radius: var(--radius-md);
    color: var(--accent-lilac);
  }

  .predictions-header__title {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .predictions-header__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 2px 0 0;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    cursor: pointer;
    transition: all var(--dur-fast) var(--ease-standard);
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--glass-white);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .refresh-btn:disabled { opacity: 0.5; cursor: default; }

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Search form ─── */
  .search-form { display: flex; flex-direction: column; gap: var(--space-xs); }

  .search-form__wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 4px 4px 4px var(--space-lg);
    transition: border-color var(--dur-fast) var(--ease-standard);
  }

  .search-form__wrap:focus-within {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.12);
  }

  .search-form__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    padding: 10px 0;
    color: var(--text-primary);
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    min-width: 0;
  }

  .search-form__input::placeholder { color: var(--text-muted); }

  .search-form__btn {
    padding: var(--space-sm) var(--space-lg);
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    border-radius: var(--radius-sm);
    color: var(--accent-lilac);
    font-family: var(--font-body);
    font-size: var(--text-micro);
    font-weight: 600;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard);
    flex-shrink: 0;
  }

  .search-form__btn:hover:not(:disabled) { background: rgba(167, 155, 255, 0.18); color: var(--text-primary); }
  .search-form__btn:disabled { opacity: 0.5; cursor: default; }

  .search-form__error {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--status-error);
    padding: 0 var(--space-md);
    margin: 0;
  }

  /* ── Stats ─── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
  }

  @media (max-width: 600px) {
    .stats-row { grid-template-columns: 1fr; }
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
  }

  .stat-card :global(svg) { color: var(--accent-lilac); }

  .stat-label {
    font-family: var(--font-technical);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .stat-value--sm {
    font-family: var(--font-technical);
    font-size: 13px;
    font-weight: 500;
  }

  /* ── Tabs ─── */
  .tabs {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--border-soft);
    overflow-x: auto;
    padding-bottom: 1px;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-lg);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    font-weight: 500;
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
    white-space: nowrap;
  }

  .tab:hover { color: var(--text-secondary); }

  .tab--active {
    color: var(--accent-lilac);
    border-bottom-color: var(--accent-lilac);
  }

  .tab__badge {
    padding: 1px 6px;
    font-family: var(--font-technical);
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-full);
    background: rgba(167, 155, 255, 0.12);
    color: var(--accent-lilac);
  }

  .tab__badge--buy  { background: rgba(74, 222, 128, 0.12); color: #4ade80; }
  .tab__badge--sell { background: rgba(248, 113, 113, 0.12); color: #f87171; }

  /* ── Cards grid ─── */
  .cards-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-sm);
  }

  /* ── Loading / Error / Empty ─── */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-4xl);
    color: var(--text-muted);
    text-align: center;
  }

  .loading-orb {
    width: 40px;
    height: 40px;
    border: 2px solid rgba(167, 155, 255, 0.3);
    border-top-color: var(--accent-lilac);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .empty-state :global(svg) { color: var(--accent-lilac); opacity: 0.6; }

  .empty-state__msg {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-secondary);
    margin: 0;
  }

  .empty-state__hint {
    font-family: var(--font-body);
    font-size: 12px;
    margin: 0;
  }

  .retry-btn {
    padding: var(--space-sm) var(--space-xl);
    background: var(--glass-white);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    cursor: pointer;
  }
  .retry-btn:hover { border-color: var(--border-strong); }

  /* ── Methodology ─── */
  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: var(--space-xl) 0 var(--space-md);
  }

  .methodology__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }

  @media (max-width: 600px) {
    .methodology__grid { grid-template-columns: 1fr; }
  }

  .methodology__item {
    padding: var(--space-lg);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
  }

  .methodology__item strong {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--accent-lilac);
    margin-bottom: 6px;
  }

  .methodology__item p {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  /* ── Disclaimer ─── */
  .disclaimer {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: rgba(251, 191, 36, 0.05);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: var(--radius-lg);
    color: rgba(251, 191, 36, 0.8);
    align-items: flex-start;
  }

  .disclaimer p {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .disclaimer strong { color: rgba(251, 191, 36, 0.9); }
</style>

