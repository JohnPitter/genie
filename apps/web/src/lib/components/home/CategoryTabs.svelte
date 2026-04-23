<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Category } from '@genie/shared';

  export let categories: Category[] = [];
  export let active: Category = 'financeiro';

  const dispatch = createEventDispatcher<{ change: Category }>();

  const LABELS: Record<Category, string> = {
    financeiro:  '📈 Financeiro',
    commodities: '⚗️ Commodities',
    varejo:      '🛍️ Varejo',
    energia:     '⚡ Energia',
    saneamento:  '💧 Saneamento',
    tecnologia:  '💻 Tecnologia',
    saude:       '🏥 Saúde',
  };

  function select(cat: Category) {
    active = cat;
    dispatch('change', cat);
  }
</script>

<nav class="category-tabs" aria-label="Categorias de notícias">
  <div class="category-tabs__scroll" role="tablist">
    {#each categories as cat (cat)}
      <button
        class="category-tabs__pill"
        class:category-tabs__pill--active={cat === active}
        role="tab"
        aria-selected={cat === active}
        aria-label={`Categoria ${LABELS[cat]}`}
        on:click={() => select(cat)}
      >
        {LABELS[cat]}
      </button>
    {/each}
  </div>
</nav>

<style>
  .category-tabs {
    width: 100%;
  }

  .category-tabs__scroll {
    display: flex;
    gap: var(--space-sm);
    overflow-x: auto;
    padding-bottom: var(--space-xs);
    /* Hide scrollbar visually but keep functionality */
    scrollbar-width: none;
  }

  .category-tabs__scroll::-webkit-scrollbar {
    display: none;
  }

  .category-tabs__pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-full);
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    font-weight: 500;
    letter-spacing: 0.03em;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--border-soft);
    color: var(--text-muted);
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
    flex-shrink: 0;
  }

  .category-tabs__pill:hover:not(.category-tabs__pill--active) {
    background: var(--glass-white);
    border-color: var(--border-strong);
    color: var(--text-secondary);
  }

  .category-tabs__pill--active {
    background: var(--glass-gold);
    border-color: var(--accent-gold);
    color: var(--accent-gold);
    box-shadow: var(--glow-gold);
  }

  .category-tabs__pill:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--border-interactive);
  }
</style>
