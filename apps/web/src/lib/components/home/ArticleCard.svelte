<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import { formatRelativeTime } from '$lib/utils/time';
  import type { Article } from '@genie/shared';

  export let article: Article;
  export let category: string = '';

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
  data-category={category}
  on:click={handleClick}
  on:keydown={handleKeydown}
  tabindex="0"
  role="button"
  aria-label={`Abrir notícia: ${article.title}`}
>
  <div class="article-card__inner">
    <h3 class="article-card__title">{article.title}</h3>

    <div class="article-card__meta">
      {#if article.source}
        <span class="article-card__source-badge">{article.source}</span>
      {/if}
      {#if relativeTime}
        <span class="article-card__time">{relativeTime}</span>
      {/if}
    </div>

    {#if article.summary}
      <p class="article-card__summary">{article.summary}</p>
    {/if}

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
    background: linear-gradient(160deg, #18191f 0%, #101115 100%);
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
    transform: translateY(-3px);
    box-shadow: var(--shadow-hover);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .article-card:focus-visible {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.25);
  }

  .article-card:active { transform: translateY(-1px); }

  /* ── Top accent line per category ────────────────────── */
  .article-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: rgba(167, 155, 255, 0.5);
    pointer-events: none;
    z-index: 2;
    opacity: 0.7;
    transition: opacity var(--dur-medium) var(--ease-standard);
  }

  .article-card:hover::after { opacity: 1; }

  .article-card[data-category="financeiro"]::after   { background: rgba(167, 155, 255, 0.7); }
  .article-card[data-category="tecnologia"]::after   { background: rgba(140, 184, 255, 0.7); }
  .article-card[data-category="energia"]::after      { background: rgba(232, 197, 106, 0.7); }
  .article-card[data-category="commodities"]::after  { background: rgba(207, 194, 154, 0.7); }
  .article-card[data-category="varejo"]::after       { background: rgba(126, 214, 167, 0.6); }
  .article-card[data-category="saneamento"]::after   { background: rgba(126, 214, 167, 0.5); }
  .article-card[data-category="saude"]::after        { background: rgba(240, 124, 124, 0.6); }

  /* Premium gradient border on hover */
  .article-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: var(--gradient-border-premium);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--dur-medium) var(--ease-standard);
  }

  .article-card:hover::before,
  .article-card:focus-visible::before { opacity: 1; }

  .article-card__inner {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
  }

  .article-card__title {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    flex-shrink: 0;
    letter-spacing: -0.01em;
  }

  .article-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .article-card__source-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.11);
    font-family: var(--font-technical);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
    white-space: nowrap;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .article-card__time {
    font-family: var(--font-technical);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .article-card__summary {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    flex-shrink: 0;
  }

  .article-card__tickers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 4px;
    margin-top: auto;
    flex-shrink: 0;
  }
</style>
