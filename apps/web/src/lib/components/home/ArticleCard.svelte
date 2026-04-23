<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import { formatRelativeTime } from '$lib/utils/time';
  import type { Article } from '@genie/shared';

  export let article: Article;

  $: relativeTime = article.publishedAt
    ? formatRelativeTime(article.publishedAt)
    : '';

  function handleClick() {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<div
  class="article-card"
  on:click={handleClick}
  on:keydown={handleKeydown}
  tabindex="0"
  role="button"
  aria-label={`Abrir notícia: ${article.title}`}
>
  <div class="article-card__inner">
    <!-- Title -->
    <h3 class="article-card__title">{article.title}</h3>

    <!-- Meta: source + time -->
    <div class="article-card__meta">
      <span class="article-card__source">{article.source}</span>
      {#if relativeTime}
        <span class="article-card__sep" aria-hidden="true">·</span>
        <span class="article-card__time">{relativeTime}</span>
      {/if}
    </div>

    <!-- Summary/snippet -->
    {#if article.summary}
      <p class="article-card__summary">{article.summary}</p>
    {/if}

    <!-- Tickers -->
    {#if article.tickers && article.tickers.length > 0}
      <div class="article-card__tickers" aria-label="Tickers relacionados">
        {#each article.tickers as ticker (ticker)}
          <Badge variant="gold" size="sm">{ticker}</Badge>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .article-card {
    background: linear-gradient(180deg, #17181D 0%, #111217 100%);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
      transform var(--dur-medium) var(--ease-standard),
      box-shadow var(--dur-medium) var(--ease-standard),
      border-color var(--dur-medium) var(--ease-standard);
    outline: none;
  }

  .article-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-hover);
    border-color: var(--border-strong);
  }

  .article-card:focus-visible {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.25);
  }

  .article-card:active {
    transform: translateY(-2px);
  }

  /* Premium gradient border via pseudo-element */
  .article-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: var(--gradient-border-premium);
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--dur-medium) var(--ease-standard);
  }

  .article-card:hover::before,
  .article-card:focus-visible::before {
    opacity: 1;
  }

  .article-card__inner {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
  }

  /* ── Title ─────────────────────────────────── */
  .article-card__title {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* ── Meta ──────────────────────────────────── */
  .article-card__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .article-card__source {
    color: var(--text-muted);
    font-weight: 500;
  }

  .article-card__sep {
    color: var(--text-muted);
  }

  .article-card__time {
    color: var(--text-muted);
  }

  /* ── Summary ───────────────────────────────── */
  .article-card__summary {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    flex-shrink: 0;
  }

  /* ── Tickers ───────────────────────────────── */
  .article-card__tickers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 4px;
    margin-top: auto;
    flex-shrink: 0;
  }
</style>
