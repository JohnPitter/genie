<script lang="ts">
  import { History } from 'lucide-svelte';
  import type { EditorialSummary, EditorialSlot } from '@genie/shared';

  export let editions: EditorialSummary[] = [];
  export let currentId: number | null = null;

  const SLOT_HOUR: Record<EditorialSlot, string> = {
    '08': '08h', '12': '12h', '16': '16h', '20': '20h',
  };

  function formatShortDate(yyyymmdd: string): string {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    if (!y || !m || !d) return yyyymmdd;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  }
</script>

<aside class="editorial-archive" aria-label="Edições anteriores">
  <header class="editorial-archive__header">
    <History size={14} />
    <h2 class="editorial-archive__title">Edições anteriores</h2>
  </header>

  {#if editions.length === 0}
    <p class="editorial-archive__empty">Nenhuma edição arquivada.</p>
  {:else}
    <ul class="editorial-archive__list">
      {#each editions as ed (ed.id)}
        <li>
          <a
            href={`/editorial/${ed.id}`}
            class="editorial-archive__item"
            class:editorial-archive__item--current={ed.id === currentId}
            aria-current={ed.id === currentId ? 'page' : undefined}
          >
            <div class="editorial-archive__item-meta">
              <span class="editorial-archive__slot">{SLOT_HOUR[ed.slot]}</span>
              <span class="editorial-archive__date">{formatShortDate(ed.editionDate)}</span>
            </div>
            <span class="editorial-archive__lead">{ed.leadTitle}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .editorial-archive {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 22px;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    background: linear-gradient(160deg, #16171c 0%, #0e0f13 100%);
  }

  .editorial-archive__header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-archive__title {
    margin: 0;
    font-family: var(--font-technical, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .editorial-archive__empty {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-archive__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .editorial-archive__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: var(--radius-sm, 6px);
    text-decoration: none;
    color: var(--text-secondary, #b8bac4);
    transition: background var(--dur-fast, 120ms) ease, color var(--dur-fast, 120ms) ease;
    border-left: 2px solid transparent;
  }

  .editorial-archive__item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #fafafa);
    border-left-color: rgba(167, 155, 255, 0.4);
  }

  .editorial-archive__item--current {
    background: rgba(167, 155, 255, 0.08);
    color: var(--text-primary, #fafafa);
    border-left-color: var(--accent-lilac, #a79bff);
  }

  .editorial-archive__item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-technical, monospace);
    font-size: 11px;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-archive__slot {
    font-weight: 600;
    color: var(--accent-lilac, #a79bff);
    letter-spacing: 0.04em;
  }

  .editorial-archive__lead {
    font-family: var(--font-body, sans-serif);
    font-size: 13px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
</style>
