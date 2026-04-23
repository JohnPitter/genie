<script lang="ts">
  import { Newspaper } from 'lucide-svelte';
  import type { Article } from '@genie/shared';

  export let articles: Article[] = [];

  $: sorted = [...articles].sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });
</script>

<div class="news">
  {#if sorted.length === 0}
    <div class="news__empty">
      <Newspaper size={48} aria-hidden="true" />
      <p>Nenhuma notícia disponível para este ativo.</p>
    </div>
  {:else}
    <ul class="news__list">
      {#each sorted as article}
        <li class="news__item">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            class="news__link"
          >
            <span class="news__title">{article.title}</span>
            <div class="news__meta">
              <span class="news__source">{article.source}</span>
              {#if article.publishedAt}
                <span class="news__date">
                  {new Date(article.publishedAt).toLocaleDateString('pt-BR')}
                </span>
              {/if}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .news {
    display: flex;
    flex-direction: column;
  }

  .news__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-4xl) 0;
    color: var(--text-muted);
    text-align: center;
  }

  .news__empty p {
    font-size: 14px;
    margin: 0;
  }

  .news__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .news__item {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .news__item:last-child {
    border-bottom: none;
  }

  .news__link {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-lg) 0;
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-standard);
    border-radius: var(--radius-sm);
  }

  .news__link:hover .news__title {
    color: var(--text-primary);
    text-decoration: underline;
  }

  .news__title {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
    transition: color var(--dur-fast) var(--ease-standard);
  }

  .news__meta {
    display: flex;
    gap: var(--space-lg);
    align-items: center;
  }

  .news__source {
    font-size: 12px;
    color: var(--accent-lilac);
    font-weight: 500;
  }

  .news__date {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
