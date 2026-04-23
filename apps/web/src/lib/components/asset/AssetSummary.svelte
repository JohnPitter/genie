<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import type { Quote, Article } from '@genie/shared';
  import { statusInvestURL } from '$lib/utils/asset';
  import { createEventDispatcher } from 'svelte';

  export let quote: Quote;
  export let news: Article[] = [];

  const dispatch = createEventDispatcher<{ viewNews: void }>();

  $: latestNews = news.slice(0, 3);
  $: updatedAt = new Date(quote.updatedAt).toLocaleString('pt-BR');
</script>

<div class="summary">
  <div class="summary__section">
    <h3 class="summary__heading">Última atualização</h3>
    <p class="summary__value">{updatedAt} · Fonte: {quote.source}</p>
  </div>

  <div class="summary__section">
    <a
      href={statusInvestURL(quote.ticker)}
      target="_blank"
      rel="noopener noreferrer"
      class="summary__link"
    >
      Ver no Status Invest
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  </div>

  {#if latestNews.length > 0}
    <div class="summary__section">
      <h3 class="summary__heading">Notícias recentes</h3>
      <ul class="summary__news">
        {#each latestNews as article}
          <li class="summary__news-item">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              class="summary__news-link"
            >
              {article.title}
            </a>
            {#if article.source}
              <span class="summary__news-source">{article.source}</span>
            {/if}
          </li>
        {/each}
      </ul>
      <button class="summary__more" on:click={() => dispatch('viewNews')}>
        Ver todas as notícias →
      </button>
    </div>
  {:else}
    <div class="summary__section">
      <p class="summary__empty">Nenhuma notícia recente disponível.</p>
    </div>
  {/if}
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  .summary__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .summary__heading {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }

  .summary__value {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }

  .summary__link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 14px;
    color: var(--accent-lilac);
    text-decoration: none;
    transition: color var(--dur-fast) var(--ease-standard);
  }

  .summary__link:hover {
    color: var(--text-primary);
  }

  .summary__news {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .summary__news-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .summary__news-link {
    font-size: 14px;
    color: var(--text-secondary);
    text-decoration: none;
    line-height: 1.4;
    transition: color var(--dur-fast) var(--ease-standard);
  }

  .summary__news-link:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  .summary__news-source {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .summary__more {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--accent-lilac);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    transition: color var(--dur-fast) var(--ease-standard);
  }

  .summary__more:hover {
    color: var(--text-primary);
  }

  .summary__empty {
    font-size: 14px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }
</style>
