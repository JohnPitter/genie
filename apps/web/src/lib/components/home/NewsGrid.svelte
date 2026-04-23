<script lang="ts">
  import { onMount } from 'svelte';
  import { Newspaper } from 'lucide-svelte';
  import ArticleCard from './ArticleCard.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import { apiClient } from '$lib/api/client';
  import type { Article, Category } from '@genie/shared';
  import type { ApiClient } from '$lib/api/client';

  export let category: Category;
  export let limit = 12;
  /** Inject a custom ApiClient for testing */
  export let client: ApiClient = apiClient;
  /** Exposed so parent can read loaded articles (e.g. to pass as agent context) */
  export let articles: Article[] = [];

  type LoadingState = 'idle' | 'loading' | 'success' | 'error';

  let state: LoadingState = 'idle';
  let errorMsg = '';

  // Simple in-memory cache per category
  const cache = new Map<string, Article[]>();

  async function load(cat: Category) {
    const cacheKey = `${cat}:${limit}`;

    if (cache.has(cacheKey)) {
      articles = cache.get(cacheKey)!;
      state = 'success';
      return;
    }

    state = 'loading';
    errorMsg = '';

    try {
      const result = await client.getNewsByCategory(cat, limit);
      articles = result;
      cache.set(cacheKey, result);
      state = 'success';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      errorMsg = msg;
      state = 'error';
    }
  }

  // Reactive: re-fetch when category changes
  $: load(category);

  onMount(() => {
    // load already triggered by reactive statement
  });
</script>

<div class="news-grid" aria-label={`Notícias de ${category}`}>
  {#if state === 'loading' || state === 'idle'}
    <!-- Skeleton placeholder cards -->
    <div class="news-grid__grid news-grid__grid--loading">
      {#each { length: 6 } as _}
        <div class="news-grid__skeleton-card">
          <Skeleton height="15px" rounded="sm" />
          <Skeleton height="15px" width="85%" rounded="sm" />
          <Skeleton height="15px" width="55%" rounded="sm" />
          <Skeleton height="12px" width="40%" rounded="sm" />
          <Skeleton height="52px" rounded="sm" />
          <div class="news-grid__skeleton-badges">
            <Skeleton height="20px" width="56px" rounded="full" />
            <Skeleton height="20px" width="48px" rounded="full" />
          </div>
        </div>
      {/each}
    </div>

  {:else if state === 'error'}
    <div class="news-grid__error" role="alert">
      <p class="news-grid__error-msg">{errorMsg}</p>
      <button
        class="news-grid__retry-btn"
        on:click={() => load(category)}
        aria-label="Tentar carregar notícias novamente"
      >
        Tentar novamente
      </button>
    </div>

  {:else if state === 'success' && articles.length === 0}
    <div class="news-grid__empty">
      <Newspaper size={40} aria-hidden="true" />
      <p class="news-grid__empty-msg">Nenhuma notícia disponível para esta categoria.</p>
    </div>

  {:else}
    <div class="news-grid__grid">
      {#each articles as article (article.id ?? article.url)}
        <ArticleCard {article} {category} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .news-grid {
    width: 100%;
  }

  /* ── Grid layout ───────────────────────────── */
  .news-grid__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  @media (min-width: 640px) {
    .news-grid__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .news-grid__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ── Skeleton cards ──────────────────────────*/
  .news-grid__skeleton-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: 20px;
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
  }

  .news-grid__skeleton-badges {
    display: flex;
    gap: var(--space-xs);
    margin-top: auto;
  }

  /* ── Error state ───────────────────────────── */
  .news-grid__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-3xl);
    text-align: center;
  }

  .news-grid__error-msg {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--status-error);
    margin: 0;
  }

  .news-grid__retry-btn {
    padding: var(--space-sm) var(--space-xl);
    background: rgba(240, 124, 124, 0.08);
    border: 1px solid rgba(240, 124, 124, 0.4);
    border-radius: var(--radius-md);
    color: var(--status-error);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard);
  }

  .news-grid__retry-btn:hover {
    background: rgba(240, 124, 124, 0.14);
    border-color: rgba(240, 124, 124, 0.7);
  }

  .news-grid__retry-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(240, 124, 124, 0.35);
  }

  /* ── Empty state ───────────────────────────── */
  .news-grid__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-3xl);
    color: var(--text-muted);
    text-align: center;
  }

  .news-grid__empty-msg {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    margin: 0;
    color: var(--text-muted);
  }
</style>
