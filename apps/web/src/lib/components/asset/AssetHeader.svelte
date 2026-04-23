<script lang="ts">
  import { Star } from 'lucide-svelte';
  import type { Quote } from '@genie/shared';
  import { favoritesStore, favoritesActions } from '$lib/stores/favorites';
  import { changeColor, formatChangePct } from '$lib/utils/asset';

  export let quote: Quote;
  export let ticker: string;

  $: isFavorite = $favoritesStore.tickers.has(ticker.toUpperCase());
  $: priceColor = changeColor(quote.changePct);

  function handleFavorite() {
    favoritesActions.toggle(ticker);
  }
</script>

<header class="asset-header">
  <div class="asset-header__left">
    <div class="asset-header__ticker">{ticker}</div>
    <div class="asset-header__name">{quote.name || '—'}</div>
  </div>

  <button
    class="asset-header__favorite"
    class:active={isFavorite}
    on:click={handleFavorite}
    aria-label={isFavorite ? `Remover ${ticker} dos favoritos` : `Favoritar ${ticker}`}
    aria-pressed={isFavorite}
  >
    <Star
      size={20}
      fill={isFavorite ? 'currentColor' : 'none'}
      aria-hidden="true"
    />
    {isFavorite ? 'Favoritado' : 'Favoritar'}
  </button>
</header>

<div class="asset-price">
  <span class="asset-price__value">
    {quote.currency === 'BRL' ? 'R$' : quote.currency}
    {quote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
  <span class="asset-price__change {priceColor}">
    {formatChangePct(quote.changePct)}
  </span>
</div>

<div class="asset-meta">
  {#if quote.volume}
    <span class="asset-meta__item">
      <span class="asset-meta__label">Volume</span>
      <span class="asset-meta__value">{(quote.volume / 1_000_000).toFixed(1)}M</span>
    </span>
  {/if}
  {#if quote.marketCap}
    <span class="asset-meta__item">
      <span class="asset-meta__label">Mkt Cap</span>
      <span class="asset-meta__value">
        R$ {(quote.marketCap / 1_000_000_000).toFixed(1)}B
      </span>
    </span>
  {/if}
  <span class="asset-meta__item">
    <span class="asset-meta__label">Fonte</span>
    <span class="asset-meta__value">{quote.source}</span>
  </span>
</div>

<style>
  .asset-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-xl);
    min-width: 0;
  }

  .asset-header__left {
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .asset-header__ticker {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .asset-header__name {
    font-size: 14px;
    color: var(--text-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-header__favorite {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
    transition:
      color var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      background var(--dur-fast) var(--ease-standard);
  }

  /* Mobile: smaller price + gap + show only icon on favorite button to save space */
  @media (max-width: 600px) {
    .asset-header { gap: var(--space-sm); }
    .asset-header__ticker { font-size: 26px; }
    .asset-header__favorite {
      padding: var(--space-sm);
      font-size: 0;
      gap: 0;
    }
    .asset-header__favorite :global(svg) { width: 18px; height: 18px; }
  }

  .asset-header__favorite:hover {
    border-color: var(--accent-gold);
    color: var(--accent-gold);
  }

  .asset-header__favorite.active {
    border-color: var(--accent-gold);
    color: var(--accent-gold);
    background: rgba(207, 194, 154, 0.08);
  }

  .asset-price {
    display: flex;
    align-items: baseline;
    gap: var(--space-lg);
    margin-top: var(--space-xl);
  }

  .asset-price__value {
    font-family: var(--font-technical, monospace);
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .asset-price__change {
    font-family: var(--font-technical, monospace);
    font-size: 20px;
    font-weight: 600;
  }

  @media (max-width: 600px) {
    .asset-price { flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-md); }
    .asset-price__value { font-size: 36px; }
    .asset-price__change { font-size: 16px; }
    .asset-meta { gap: var(--space-lg); flex-wrap: wrap; margin-top: var(--space-md); }
  }

  .text-success { color: var(--status-success); }
  .text-error   { color: var(--status-error); }
  .text-muted   { color: var(--text-muted); }

  .asset-meta {
    display: flex;
    gap: var(--space-2xl);
    margin-top: var(--space-lg);
  }

  .asset-meta__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .asset-meta__label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .asset-meta__value {
    font-family: var(--font-technical, monospace);
    font-size: 14px;
    color: var(--text-secondary);
  }
</style>
