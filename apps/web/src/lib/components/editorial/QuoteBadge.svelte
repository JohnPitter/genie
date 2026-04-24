<script lang="ts">
  import type { Quote } from '@genie/shared';

  export let ticker: string;
  export let quote: Quote | undefined;

  const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  $: change = quote?.changePct ?? null;
  $: price = quote?.price ?? null;
  $: positive = change !== null && change > 0;
  $: negative = change !== null && change < 0;
  $: arrow = positive ? '↑' : negative ? '↓' : '→';
  $: formatted = change !== null ? `${positive ? '+' : ''}${change.toFixed(2)}%` : null;
  $: priceFormatted = price !== null ? brlFmt.format(price) : null;
</script>

<a
  href={`/asset/${ticker}`}
  class="quote-badge"
  class:quote-badge--up={positive}
  class:quote-badge--down={negative}
  class:quote-badge--flat={!positive && !negative}
  title={quote ? `${ticker}: ${priceFormatted} (${formatted})` : ticker}
>
  <span class="quote-badge__ticker">{ticker}</span>
  {#if quote}
    <span class="quote-badge__sep">·</span>
    <span class="quote-badge__price">{priceFormatted}</span>
    <span class="quote-badge__change">
      {arrow} {formatted}
    </span>
  {/if}
</a>

<style>
  .quote-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: var(--radius-full, 999px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    font-family: var(--font-technical, monospace);
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition:
      background var(--dur-fast, 120ms) ease,
      border-color var(--dur-fast, 120ms) ease,
      transform var(--dur-fast, 120ms) ease;
    letter-spacing: 0.02em;
    color: var(--text-secondary, #b8bac4);
  }

  .quote-badge:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.09);
  }

  .quote-badge--up {
    border-color: rgba(126, 214, 167, 0.3);
    background: rgba(126, 214, 167, 0.07);
    color: rgb(126, 214, 167);
  }

  .quote-badge--up:hover {
    background: rgba(126, 214, 167, 0.13);
    border-color: rgba(126, 214, 167, 0.5);
  }

  .quote-badge--down {
    border-color: rgba(240, 124, 124, 0.3);
    background: rgba(240, 124, 124, 0.07);
    color: rgb(240, 124, 124);
  }

  .quote-badge--down:hover {
    background: rgba(240, 124, 124, 0.13);
    border-color: rgba(240, 124, 124, 0.5);
  }

  .quote-badge__ticker {
    font-weight: 700;
    color: inherit;
  }

  .quote-badge__sep {
    opacity: 0.4;
  }

  .quote-badge__price {
    opacity: 0.85;
    font-weight: 500;
    font-size: 11px;
  }

  .quote-badge__change {
    font-weight: 700;
    font-size: 11px;
  }
</style>
