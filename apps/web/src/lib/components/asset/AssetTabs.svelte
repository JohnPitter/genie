<script context="module" lang="ts">
  export type AssetTab = 'summary' | 'fundamentals' | 'news' | 'chat';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let active: AssetTab = 'summary';

  const dispatch = createEventDispatcher<{ change: AssetTab }>();

  const tabs: { id: AssetTab; label: string }[] = [
    { id: 'summary',      label: 'Resumo' },
    { id: 'fundamentals', label: 'Fundamentos' },
    { id: 'news',         label: 'Notícias' },
    { id: 'chat',         label: 'Chat' },
  ];

  function selectTab(tab: AssetTab) {
    active = tab;
    dispatch('change', tab);
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectTab(tabs[index].id);
      return;
    } else {
      return;
    }
    event.preventDefault();
    const el = document.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next].id}"]`);
    el?.focus();
    selectTab(tabs[next].id);
  }
</script>

<div class="tabs" role="tablist" aria-label="Seções do ativo">
  {#each tabs as tab, i}
    <button
      class="tab"
      class:active={active === tab.id}
      role="tab"
      aria-selected={active === tab.id ? 'true' : 'false'}
      tabindex={active === tab.id ? 0 : -1}
      data-tab={tab.id}
      on:click={() => selectTab(tab.id)}
      on:keydown={(e) => handleKeydown(e, i)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: var(--space-xs);
    padding: var(--space-sm);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar { display: none; }

  .tab {
    padding: var(--space-sm) var(--space-xl);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-family: var(--font-body);
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard);
  }

  @media (max-width: 600px) {
    .tab { padding: var(--space-sm) var(--space-md); font-size: 13px; }
  }

  .tab:hover:not(.active) {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.04);
  }

  .tab.active {
    background: var(--accent-violet);
    color: var(--text-primary);
    font-weight: 600;
  }

  .tab:focus-visible {
    outline: 2px solid var(--accent-lilac);
    outline-offset: 2px;
  }
</style>
