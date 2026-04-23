<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {
    TrendingUp, TrendingDown, Minus, ChevronLeft,
    AlertTriangle, RefreshCw, BarChart2, Activity,
    ShieldAlert
  } from 'lucide-svelte';
  import { apiClient } from '$lib/api/client';
  import type { StockAnalysis, HistoryPoint } from '@genie/shared';

  $: ticker = $page.params.ticker?.toUpperCase() ?? '';

  let analysis: StockAnalysis | null = null;
  let loading = false;
  let error = '';

  onMount(() => { load(); });

  async function load() {
    if (!ticker) return;
    loading = true;
    error = '';
    analysis = null;
    try {
      analysis = await apiClient.getStockAnalysis(ticker);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Falha ao carregar análise.';
    } finally {
      loading = false;
    }
  }

  // ── Sparkline SVG ────────────────────────────────────────────────────────────

  function buildSparkline(history: HistoryPoint[], width = 320, height = 80): string {
    if (!history.length) return '';
    const closes = history.map(p => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const step = width / (closes.length - 1);
    const points = closes.map((c, i) => {
      const x = i * step;
      const y = height - ((c - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points.join(' L ')}`;
  }

  function sparklineColor(changePct: number): string {
    return changePct >= 0 ? '#4ade80' : '#f87171';
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function fmtBRL(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  }

  function fmtPct(v: number, decimals = 2): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;
  }

  function rsiClass(rsi: number): string {
    if (rsi >= 70) return 'indicator--danger';
    if (rsi <= 30) return 'indicator--success';
    if (rsi >= 60) return 'indicator--warn';
    if (rsi <= 40) return 'indicator--info';
    return '';
  }

  function rsiBar(rsi: number): number {
    return Math.max(0, Math.min(100, rsi));
  }

  $: sparkPath = analysis ? buildSparkline(analysis.history) : '';
  $: sparkColor = analysis ? sparklineColor(analysis.changePct) : '#a79bff';
</script>

<svelte:head>
  <title>{ticker} — Análise de IA | Genie</title>
</svelte:head>

<main class="analysis-page">
  <!-- Back nav -->
  <nav class="analysis-page__nav">
    <a href="/asset/{ticker}" class="back-link">
      <ChevronLeft size={16} />
      {ticker}
    </a>
    <span class="nav-divider">/</span>
    <span class="nav-current">Análise IA</span>
  </nav>

  {#if loading}
    <!-- ── Loading state ── -->
    <div class="analysis-page__loading">
      <div class="loading-orb" aria-hidden="true">
        <div class="loading-orb__ring"></div>
        <div class="loading-orb__core"></div>
      </div>
      <p class="loading-title">Analisando {ticker}…</p>
      <p class="loading-sub">Calculando indicadores técnicos e consultando o modelo de IA.<br/>Isso pode levar até 30 segundos.</p>
      <div class="loading-steps">
        <span>📊 Histórico</span>
        <span>⚙️ Indicadores</span>
        <span>🤖 Análise LLM</span>
      </div>
    </div>

  {:else if error}
    <!-- ── Error state ── -->
    <div class="analysis-page__error">
      <AlertTriangle size={40} />
      <p class="error-msg">{error}</p>
      <button class="retry-btn" on:click={load}>
        <RefreshCw size={14} /> Tentar novamente
      </button>
    </div>

  {:else if analysis}
    <!-- ── Header ── -->
    <header class="analysis-header">
      <div class="analysis-header__left">
        <h1 class="analysis-header__ticker">{analysis.ticker}</h1>
        <span class="analysis-header__name">{analysis.name}</span>
      </div>
      <div class="analysis-header__right">
        <span class="analysis-header__price">{fmtBRL(analysis.price)}</span>
        <span class="analysis-header__change" class:positive={analysis.changePct >= 0} class:negative={analysis.changePct < 0}>
          {#if analysis.changePct >= 0}<TrendingUp size={14} />{:else}<TrendingDown size={14} />{/if}
          {fmtPct(analysis.changePct)}
        </span>
      </div>
    </header>

    <!-- ── Sparkline chart ── -->
    <div class="sparkline-card">
      <div class="sparkline-card__header">
        <span class="sparkline-card__label">
          <Activity size={14} />
          Histórico 60 dias
        </span>
        {#if analysis.indicators.return30d != null}
          <span class="sparkline-card__return" class:positive={analysis.indicators.return30d >= 0} class:negative={analysis.indicators.return30d < 0}>
            30d: {fmtPct(analysis.indicators.return30d, 1)}
          </span>
        {/if}
      </div>
      <svg
        class="sparkline"
        viewBox="0 0 320 80"
        preserveAspectRatio="none"
        aria-label="Gráfico de preço 60 dias"
        role="img"
      >
        <!-- Area fill -->
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={sparkColor} stop-opacity="0.25" />
            <stop offset="100%" stop-color={sparkColor} stop-opacity="0.02" />
          </linearGradient>
        </defs>
        {#if sparkPath}
          <path
            d="{sparkPath} V 80 H 0 Z"
            fill="url(#sparkGrad)"
          />
          <path
            d={sparkPath}
            fill="none"
            stroke={sparkColor}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/if}
      </svg>
      {#if analysis.indicators.high52w || analysis.indicators.low52w}
        <div class="sparkline-card__range">
          {#if analysis.indicators.low52w}<span>Mín 52s: {fmtBRL(analysis.indicators.low52w)}</span>{/if}
          {#if analysis.indicators.high52w}<span>Máx 52s: {fmtBRL(analysis.indicators.high52w)}</span>{/if}
        </div>
      {/if}
    </div>

    <!-- ── AI Signal card ── -->
    <div class="signal-card signal-card--{analysis.analysis.sinal}">
      <div class="signal-card__icon">
        {#if analysis.analysis.sinal === 'compra'}
          <TrendingUp size={28} />
        {:else if analysis.analysis.sinal === 'venda'}
          <TrendingDown size={28} />
        {:else}
          <Minus size={28} />
        {/if}
      </div>
      <div class="signal-card__body">
        <div class="signal-card__sinal">
          {analysis.analysis.sinal.toUpperCase()}
        </div>
        <div class="signal-card__meta">
          <span class="signal-badge signal-badge--confianca">
            Confiança: {analysis.analysis.confianca}
          </span>
          <span class="signal-badge">
            Horizonte: {analysis.analysis.horizonte}
          </span>
        </div>
        <p class="signal-card__racional">{analysis.analysis.racional}</p>
      </div>
    </div>

    <!-- ── Tendências ── -->
    <div class="trend-row">
      <div class="trend-item">
        <span class="trend-item__label">Curto prazo</span>
        <span class="trend-item__value trend-item__value--{analysis.analysis.tendencia_curto}">
          {#if analysis.analysis.tendencia_curto === 'alta'}<TrendingUp size={14} />{:else if analysis.analysis.tendencia_curto === 'baixa'}<TrendingDown size={14} />{:else}<Minus size={14} />{/if}
          {analysis.analysis.tendencia_curto}
        </span>
      </div>
      <div class="trend-item">
        <span class="trend-item__label">Médio prazo</span>
        <span class="trend-item__value trend-item__value--{analysis.analysis.tendencia_medio}">
          {#if analysis.analysis.tendencia_medio === 'alta'}<TrendingUp size={14} />{:else if analysis.analysis.tendencia_medio === 'baixa'}<TrendingDown size={14} />{:else}<Minus size={14} />{/if}
          {analysis.analysis.tendencia_medio}
        </span>
      </div>
      <div class="trend-item">
        <span class="trend-item__label">Suporte</span>
        <span class="trend-item__value">{fmtBRL(analysis.analysis.suporte)}</span>
      </div>
      <div class="trend-item">
        <span class="trend-item__label">Resistência</span>
        <span class="trend-item__value">{fmtBRL(analysis.analysis.resistencia)}</span>
      </div>
    </div>

    <!-- ── Indicadores técnicos ── -->
    <section class="indicators-section">
      <h2 class="section-title">
        <BarChart2 size={16} />
        Indicadores Técnicos
      </h2>

      <div class="indicators-grid">
        <!-- RSI -->
        {#if analysis.indicators.rsi14 != null}
          <div class="indicator-card {rsiClass(analysis.indicators.rsi14)}">
            <div class="indicator-card__header">
              <span class="indicator-card__name">RSI (14)</span>
              <span class="indicator-card__value">{analysis.indicators.rsi14.toFixed(1)}</span>
            </div>
            <div class="indicator-card__bar-bg">
              <div class="indicator-card__bar" style="width: {rsiBar(analysis.indicators.rsi14)}%"></div>
              <!-- Zones -->
              <div class="indicator-card__zone indicator-card__zone--oversold" style="left: 0%; width: 30%"></div>
              <div class="indicator-card__zone indicator-card__zone--overbought" style="left: 70%; width: 30%"></div>
            </div>
            <div class="indicator-card__sublabels">
              <span>Sobrevendido &lt;30</span>
              <span>&gt;70 Sobrecomprado</span>
            </div>
          </div>
        {/if}

        <!-- MACD -->
        {#if analysis.indicators.macd}
          {@const macd = analysis.indicators.macd}
          <div class="indicator-card" class:indicator--success={macd.histogram > 0} class:indicator--danger={macd.histogram < 0}>
            <div class="indicator-card__header">
              <span class="indicator-card__name">MACD (12,26,9)</span>
              <span class="indicator-card__value" class:positive={macd.histogram > 0} class:negative={macd.histogram < 0}>
                {macd.histogram > 0 ? '▲' : '▼'} {Math.abs(macd.histogram).toFixed(4)}
              </span>
            </div>
            <div class="macd-values">
              <div class="macd-item">
                <span class="macd-label">Linha</span>
                <span class="macd-val">{macd.line.toFixed(4)}</span>
              </div>
              <div class="macd-item">
                <span class="macd-label">Sinal</span>
                <span class="macd-val">{macd.signal.toFixed(4)}</span>
              </div>
              <div class="macd-item">
                <span class="macd-label">Histograma</span>
                <span class="macd-val" class:positive={macd.histogram > 0} class:negative={macd.histogram < 0}>{macd.histogram.toFixed(4)}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Médias Móveis -->
        {#if analysis.indicators.sma20 || analysis.indicators.sma50}
          <div class="indicator-card">
            <div class="indicator-card__header">
              <span class="indicator-card__name">Médias Móveis</span>
            </div>
            <div class="sma-values">
              {#if analysis.indicators.sma20}
                <div class="sma-item">
                  <span class="sma-label">SMA 20</span>
                  <span class="sma-val">{fmtBRL(analysis.indicators.sma20)}</span>
                  <span class="sma-signal" class:positive={analysis.price >= analysis.indicators.sma20} class:negative={analysis.price < analysis.indicators.sma20}>
                    {analysis.price >= analysis.indicators.sma20 ? 'Acima ↑' : 'Abaixo ↓'}
                  </span>
                </div>
              {/if}
              {#if analysis.indicators.sma50}
                <div class="sma-item">
                  <span class="sma-label">SMA 50</span>
                  <span class="sma-val">{fmtBRL(analysis.indicators.sma50)}</span>
                  <span class="sma-signal" class:positive={analysis.price >= analysis.indicators.sma50} class:negative={analysis.price < analysis.indicators.sma50}>
                    {analysis.price >= analysis.indicators.sma50 ? 'Acima ↑' : 'Abaixo ↓'}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Bollinger Bands -->
        {#if analysis.indicators.bollinger}
          {@const bb = analysis.indicators.bollinger}
          <div class="indicator-card">
            <div class="indicator-card__header">
              <span class="indicator-card__name">Bollinger Bands (20,2)</span>
              <span class="indicator-card__value">{bb.percentB.toFixed(0)}%B</span>
            </div>
            <div class="indicator-card__bar-bg">
              <div class="indicator-card__bar indicator-card__bar--purple" style="width: {Math.max(0, Math.min(100, bb.percentB))}%"></div>
            </div>
            <div class="bb-values">
              <span>Inf: {fmtBRL(bb.lower)}</span>
              <span>Méd: {fmtBRL(bb.middle)}</span>
              <span>Sup: {fmtBRL(bb.upper)}</span>
            </div>
          </div>
        {/if}

        <!-- Volatilidade -->
        {#if analysis.indicators.volatility30d != null}
          <div class="indicator-card">
            <div class="indicator-card__header">
              <span class="indicator-card__name">Volatilidade</span>
              <span class="indicator-card__value">{analysis.indicators.volatility30d.toFixed(1)}% a.a.</span>
            </div>
            <p class="indicator-card__sub">
              {analysis.indicators.volatility30d > 50 ? '🔴 Alta volatilidade' : analysis.indicators.volatility30d > 25 ? '🟡 Volatilidade moderada' : '🟢 Baixa volatilidade'}
            </p>
          </div>
        {/if}
      </div>
    </section>

    <!-- ── Pontos positivos e negativos ── -->
    <section class="points-section">
      {#if analysis.analysis.positivos.length > 0}
        <div class="points-card points-card--positive">
          <h3 class="points-card__title">✅ Pontos favoráveis</h3>
          <ul class="points-list">
            {#each analysis.analysis.positivos as p}
              <li>{p}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if analysis.analysis.negativos.length > 0}
        <div class="points-card points-card--negative">
          <h3 class="points-card__title">⚠️ Riscos identificados</h3>
          <ul class="points-list">
            {#each analysis.analysis.negativos as n}
              <li>{n}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <!-- ── Disclaimer ── -->
    <div class="disclaimer" role="note" aria-label="Aviso importante">
      <ShieldAlert size={16} />
      <p>
        <strong>Aviso importante:</strong> Esta análise é gerada automaticamente por modelos de linguagem (IA) com base em dados públicos e indicadores técnicos. Não constitui recomendação de investimento e não deve ser interpretada como tal. Investir envolve riscos, incluindo a perda total do capital. Consulte um analista financeiro credenciado pela CVM antes de tomar decisões de investimento.
      </p>
    </div>

    <p class="generated-at">Gerado em {new Date(analysis.generatedAt).toLocaleString('pt-BR')} · Cache de 30 minutos</p>
  {/if}
</main>

<style>
  .analysis-page {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-xl) var(--space-xl) var(--space-5xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  @media (max-width: 768px) {
    .analysis-page {
      padding: var(--space-md) var(--space-md) var(--space-4xl);
      gap: var(--space-lg);
    }
  }

  /* ── Nav ── */
  .analysis-page__nav {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-lilac);
    text-decoration: none;
    font-weight: 500;
  }

  .back-link:hover { text-decoration: underline; }
  .nav-divider { color: var(--border-strong); }
  .nav-current { color: var(--text-secondary); }

  /* ── Loading ── */
  .analysis-page__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-5xl) var(--space-xl);
    text-align: center;
  }

  .loading-orb {
    position: relative;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
  }

  .loading-orb__ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(167, 155, 255, 0.3);
    border-top-color: var(--accent-lilac);
    border-radius: 50%;
    animation: spin 1.2s linear infinite;
  }

  .loading-orb__core {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(237, 235, 255, 0.9) 0%, rgba(167, 155, 255, 0.5) 60%, transparent 100%);
    box-shadow: 0 0 20px rgba(167, 155, 255, 0.4);
    animation: pulse 2s ease-in-out infinite alternate;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { from { opacity: 0.7; } to { opacity: 1; } }

  .loading-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .loading-sub {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .loading-steps {
    display: flex;
    gap: var(--space-lg);
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--text-muted);
  }

  /* ── Error ── */
  .analysis-page__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-4xl);
    color: var(--status-error);
    text-align: center;
  }

  .error-msg { font-family: var(--font-body); font-size: var(--text-caption); margin: 0; }

  .retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-sm) var(--space-xl);
    background: rgba(240, 124, 124, 0.08);
    border: 1px solid rgba(240, 124, 124, 0.4);
    border-radius: var(--radius-md);
    color: var(--status-error);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard);
  }

  .retry-btn:hover { background: rgba(240, 124, 124, 0.14); }

  /* ── Header ── */
  .analysis-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .analysis-header__left { display: flex; flex-direction: column; gap: 4px; }

  .analysis-header__ticker {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .analysis-header__name {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
  }

  .analysis-header__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

  .analysis-header__price {
    font-family: var(--font-technical);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .analysis-header__change {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    font-weight: 600;
  }

  /* ── Sparkline ── */
  .sparkline-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .sparkline-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sparkline-card__label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-technical);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .sparkline-card__return {
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    font-weight: 600;
  }

  .sparkline {
    width: 100%;
    height: 80px;
    display: block;
  }

  .sparkline-card__range {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-technical);
    font-size: 11px;
    color: var(--text-muted);
  }

  /* ── Signal card ── */
  .signal-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-lg);
    padding: var(--space-xl);
    border-radius: var(--radius-lg);
    border: 1px solid;
  }

  .signal-card--compra {
    background: rgba(74, 222, 128, 0.06);
    border-color: rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }

  .signal-card--venda {
    background: rgba(248, 113, 113, 0.06);
    border-color: rgba(248, 113, 113, 0.3);
    color: #f87171;
  }

  .signal-card--neutro {
    background: rgba(167, 155, 255, 0.06);
    border-color: rgba(167, 155, 255, 0.3);
    color: var(--accent-lilac);
  }

  .signal-card__icon {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .signal-card__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
  }

  .signal-card__sinal {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .signal-card__meta {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .signal-badge {
    font-family: var(--font-technical);
    font-size: 11px;
    padding: 2px 8px;
    background: rgba(255,255,255,0.08);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .signal-card__racional {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  /* ── Trend row ── */
  .trend-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-sm);
  }

  @media (max-width: 600px) {
    .trend-row { grid-template-columns: repeat(2, 1fr); }
  }

  .trend-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-md);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
  }

  .trend-item__label {
    font-family: var(--font-technical);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .trend-item__value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-technical);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .trend-item__value--alta { color: #4ade80; }
  .trend-item__value--baixa { color: #f87171; }

  /* ── Indicators section ── */
  .section-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 var(--space-md);
  }

  .indicators-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }

  @media (max-width: 600px) {
    .indicators-grid { grid-template-columns: 1fr; }
  }

  .indicator-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    transition: border-color var(--dur-fast) var(--ease-standard);
  }

  .indicator--success { border-color: rgba(74, 222, 128, 0.3); }
  .indicator--danger  { border-color: rgba(248, 113, 113, 0.3); }
  .indicator--warn    { border-color: rgba(251, 191, 36, 0.3); }
  .indicator--info    { border-color: rgba(96, 165, 250, 0.3); }

  .indicator-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .indicator-card__name {
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--text-muted);
  }

  .indicator-card__value {
    font-family: var(--font-technical);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .indicator-card__sub {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    margin: 0;
  }

  .indicator-card__bar-bg {
    position: relative;
    height: 8px;
    background: var(--bg-surface-2, rgba(255,255,255,0.05));
    border-radius: 4px;
    overflow: hidden;
  }

  .indicator-card__bar {
    height: 100%;
    background: var(--accent-lilac);
    border-radius: 4px;
    transition: width 0.4s var(--ease-standard);
  }

  .indicator-card__bar--purple { background: var(--accent-violet); }

  .indicator-card__zone {
    position: absolute;
    top: 0;
    height: 100%;
    opacity: 0.15;
  }

  .indicator-card__zone--oversold  { background: #4ade80; }
  .indicator-card__zone--overbought { background: #f87171; }

  .indicator-card__sublabels {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
  }

  /* MACD */
  .macd-values {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-xs);
  }

  .macd-item { display: flex; flex-direction: column; gap: 2px; }
  .macd-label { font-family: var(--font-technical); font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
  .macd-val { font-family: var(--font-technical); font-size: 12px; font-weight: 600; color: var(--text-secondary); }

  /* SMA */
  .sma-values { display: flex; flex-direction: column; gap: var(--space-sm); }
  .sma-item { display: flex; align-items: center; gap: var(--space-sm); }
  .sma-label { font-family: var(--font-technical); font-size: 12px; color: var(--text-muted); width: 48px; flex-shrink: 0; }
  .sma-val { font-family: var(--font-technical); font-size: 13px; font-weight: 600; color: var(--text-secondary); flex: 1; }
  .sma-signal { font-family: var(--font-technical); font-size: 11px; font-weight: 600; }

  /* Bollinger */
  .bb-values { display: flex; justify-content: space-between; font-family: var(--font-technical); font-size: 11px; color: var(--text-muted); }

  /* ── Points ── */
  .points-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
  }

  @media (max-width: 600px) {
    .points-section { grid-template-columns: 1fr; }
  }

  .points-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
  }

  .points-card--positive { border-color: rgba(74, 222, 128, 0.2); }
  .points-card--negative { border-color: rgba(248, 113, 113, 0.2); }

  .points-card__title {
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-md);
  }

  .points-list {
    margin: 0;
    padding: 0 0 0 var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .points-list li {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  /* ── Disclaimer ── */
  .disclaimer {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: rgba(251, 191, 36, 0.05);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: var(--radius-lg);
    color: rgba(251, 191, 36, 0.8);
  }

  .disclaimer p {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .disclaimer strong { color: rgba(251, 191, 36, 0.9); }

  /* ── Generated at ── */
  .generated-at {
    font-family: var(--font-technical);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
  }

  /* ── Shared ── */
  .positive { color: #4ade80; }
  .negative { color: #f87171; }
</style>
