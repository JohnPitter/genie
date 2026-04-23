<script lang="ts">
  import { TrendingUp, TrendingDown, Minus, ExternalLink, Target } from 'lucide-svelte';
  import type { PredictionItem } from '@genie/shared';

  export let item: PredictionItem;

  // Tooltips concisos para cada indicador — glossário completo na página.
  const VOTE_HINTS: Record<string, string> = {
    'RSI': 'Índice de Força Relativa (0-100). >70 sobrecomprado, <30 sobrevendido.',
    'MACD': 'Momentum do preço. Histograma positivo = tendência de alta.',
    'Médias Móveis': 'SMA 20/50. Preço acima de ambas = tendência bullish.',
    'Bollinger': 'Bandas de volatilidade. Preço na inferior pode reverter pra cima.',
    'Volume': 'Força do movimento. Volume alto com preço subindo = interesse real.',
    'Contexto IBOV': 'Tendência do Ibovespa. Serve como filtro macro para as decisões.',
  };

  function hintFor(name: string): string {
    return VOTE_HINTS[name] ?? '';
  }

  $: isBuy = item.signal === 'compra_forte' || item.signal === 'compra';
  $: isSell = item.signal === 'venda_forte' || item.signal === 'venda';

  function fmtBRL(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  }

  function fmtPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  }

  function signalLabel(s: string): string {
    if (s === 'compra_forte') return 'Compra forte';
    if (s === 'compra') return 'Compra';
    if (s === 'venda_forte') return 'Venda forte';
    if (s === 'venda') return 'Venda';
    return 'Neutro';
  }

  // Score bar: maps -6..+6 to 0..100% center at 50
  $: scorePct = ((item.score + 6) / 12) * 100;
</script>

<a href="/analise/{item.ticker}" class="card" class:card--buy={isBuy} class:card--sell={isSell}>
  <!-- Main row -->
  <div class="card__main">
    <div class="card__ticker-block">
      <span class="card__ticker">{item.ticker}</span>
      <span class="card__name">{item.name}</span>
    </div>

    <div class="card__price-block">
      <span class="card__price">{fmtBRL(item.price)}</span>
      <span class="card__change" class:positive={item.changePct >= 0} class:negative={item.changePct < 0}>
        {#if item.changePct >= 0}<TrendingUp size={11} />{:else}<TrendingDown size={11} />{/if}
        {fmtPct(item.changePct)}
      </span>
    </div>

    <div class="card__signal-block">
      <span class="signal-badge signal-badge--{item.signal}">
        {#if isBuy}
          <TrendingUp size={13} />
        {:else if isSell}
          <TrendingDown size={13} />
        {:else}
          <Minus size={13} />
        {/if}
        {signalLabel(item.signal)}
      </span>
    </div>
  </div>

  <!-- Score bar -->
  <div class="card__score-row">
    <span class="card__score-label">Score</span>
    <div class="card__score-track">
      <div class="card__score-center"></div>
      <div
        class="card__score-fill"
        class:card__score-fill--pos={item.score > 0}
        class:card__score-fill--neg={item.score < 0}
        style="width: {Math.abs(item.score / 6) * 50}%; left: {item.score >= 0 ? 50 : 50 - Math.abs(item.score / 6) * 50}%"
      ></div>
    </div>
    <span class="card__score-value" class:positive={item.score > 0} class:negative={item.score < 0}>
      {item.score > 0 ? '+' : ''}{item.score}
    </span>
  </div>

  <!-- Votes summary -->
  {#if item.votes.length > 0}
    <div class="card__votes">
      {#each item.votes as v}
        <span
          class="vote-pill"
          class:vote-pill--pos={v.vote === 1}
          class:vote-pill--neg={v.vote === -1}
          title={hintFor(v.name)}
        >
          {v.name}
          <span class="vote-pill__icon">{v.vote === 1 ? '↑' : v.vote === -1 ? '↓' : '·'}</span>
        </span>
      {/each}
    </div>
  {/if}

  <!-- Backtest + link -->
  <div class="card__footer">
    {#if item.backtestAccuracy != null && item.backtestTotal}
      <span class="card__backtest">
        <Target size={11} />
        Acurácia 60d: <strong>{item.backtestAccuracy.toFixed(0)}%</strong>
        <span class="card__backtest-total">({item.backtestTotal} sinais)</span>
      </span>
    {:else}
      <span class="card__backtest card__backtest--none">
        Sem backtest suficiente
      </span>
    {/if}

    <span class="card__link">
      Ver análise completa <ExternalLink size={11} />
    </span>
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-lg);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    text-decoration: none;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    box-sizing: border-box;
    transition:
      border-color var(--dur-fast) var(--ease-standard),
      transform var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
  }

  @media (max-width: 600px) {
    .card {
      padding: var(--space-md);
    }
  }

  .card:hover {
    border-color: var(--border-interactive);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .card--buy  { border-left: 3px solid rgba(74, 222, 128, 0.5); }
  .card--sell { border-left: 3px solid rgba(248, 113, 113, 0.5); }

  /* ── Main row ─── */
  .card__main {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-md);
    align-items: center;
  }

  @media (max-width: 600px) {
    .card__main {
      grid-template-columns: 1fr auto;
      row-gap: var(--space-sm);
    }
    .card__signal-block { grid-column: 1 / -1; }
  }

  .card__ticker-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }

  .card__ticker {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .card__name {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card__price-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .card__price {
    font-family: var(--font-technical);
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card__change {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-technical);
    font-size: 11px;
    font-weight: 600;
  }

  .card__signal-block { display: flex; }

  /* Signal badges */
  .signal-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  .signal-badge--compra_forte {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.35);
  }
  .signal-badge--compra {
    background: rgba(74, 222, 128, 0.08);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.2);
  }
  .signal-badge--venda_forte {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.35);
  }
  .signal-badge--venda {
    background: rgba(248, 113, 113, 0.08);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.2);
  }
  .signal-badge--neutro {
    background: rgba(167, 155, 255, 0.08);
    color: var(--accent-lilac);
    border: 1px solid rgba(167, 155, 255, 0.2);
  }

  /* ── Score bar ─── */
  .card__score-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .card__score-label {
    font-family: var(--font-technical);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    width: 40px;
    flex-shrink: 0;
  }

  .card__score-track {
    position: relative;
    flex: 1;
    height: 6px;
    background: var(--bg-surface-2, rgba(255,255,255,0.05));
    border-radius: 3px;
    overflow: hidden;
  }

  .card__score-center {
    position: absolute;
    left: 50%;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--border-strong);
  }

  .card__score-fill {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s var(--ease-standard);
  }

  .card__score-fill--pos { background: #4ade80; }
  .card__score-fill--neg { background: #f87171; }

  .card__score-value {
    font-family: var(--font-technical);
    font-size: 13px;
    font-weight: 700;
    min-width: 28px;
    text-align: right;
  }

  /* ── Votes ─── */
  .card__votes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vote-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-full);
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
  }

  .vote-pill--pos {
    background: rgba(74, 222, 128, 0.06);
    border-color: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }

  .vote-pill--neg {
    background: rgba(248, 113, 113, 0.06);
    border-color: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .vote-pill__icon {
    font-weight: 700;
  }

  /* ── Footer ─── */
  .card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border-soft);
    flex-wrap: wrap;
  }

  .card__backtest {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .card__backtest strong { color: var(--accent-lilac); }
  .card__backtest-total { color: var(--text-muted); opacity: 0.7; }
  .card__backtest--none { opacity: 0.6; }

  .card__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--accent-lilac);
  }

  /* ── Utils ─── */
  .positive { color: #4ade80; }
  .negative { color: #f87171; }
</style>
