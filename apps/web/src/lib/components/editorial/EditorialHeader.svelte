<script lang="ts">
  import { Newspaper, Clock } from 'lucide-svelte';
  import type { EditorialSlot } from '@genie/shared';

  export let slot: EditorialSlot;
  export let editionDate: string;     // YYYY-MM-DD
  export let generatedAt: string;     // ISO UTC
  export let isLive = true;            // false em /editorial/[id] (arquivada)

  const SLOT_LABEL: Record<EditorialSlot, string> = {
    '08': 'Edição da Manhã',
    '12': 'Edição do Meio-dia',
    '16': 'Edição da Tarde',
    '20': 'Edição de Fechamento',
  };

  const SLOT_ORDER: EditorialSlot[] = ['08', '12', '16', '20'];

  function formatDate(yyyymmdd: string): string {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    if (!y || !m || !d) return yyyymmdd;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });
  }

  function nextSlotLabel(current: EditorialSlot): string | null {
    const idx = SLOT_ORDER.indexOf(current);
    if (idx === -1 || idx === SLOT_ORDER.length - 1) return 'Próxima edição amanhã às 08h';
    const next = SLOT_ORDER[idx + 1]!;
    return `Próxima edição às ${next}h`;
  }

  $: nextLabel = isLive ? nextSlotLabel(slot) : null;
</script>

<header class="editorial-header">
  <div class="editorial-header__brand">
    <Newspaper size={18} />
    <span class="editorial-header__brand-text">Por dentro das notícias</span>
  </div>

  <div class="editorial-header__meta">
    <h1 class="editorial-header__title">
      <span class="editorial-header__slot">{SLOT_LABEL[slot]}</span>
      <span class="editorial-header__divider" aria-hidden="true">·</span>
      <span class="editorial-header__date">{formatDate(editionDate)}</span>
    </h1>

    <div class="editorial-header__time">
      <Clock size={13} />
      <span>Publicada {formatTime(generatedAt)}</span>
      {#if nextLabel}
        <span class="editorial-header__next">· {nextLabel}</span>
      {:else if !isLive}
        <span class="editorial-header__next editorial-header__next--archived">· edição arquivada</span>
      {/if}
    </div>
  </div>
</header>

<style>
  .editorial-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 28px 32px 24px;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    background: linear-gradient(160deg, #1c1d24 0%, #131419 100%);
    position: relative;
    overflow: hidden;
  }

  .editorial-header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-lilac, #a79bff) 0%, rgba(167,155,255,0.3) 60%, transparent 100%);
  }

  .editorial-header__brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-lilac, #a79bff);
    font-family: var(--font-technical, monospace);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .editorial-header__brand-text {
    font-weight: 600;
  }

  .editorial-header__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .editorial-header__title {
    margin: 0;
    font-family: var(--font-display, serif);
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary, #fafafa);
    line-height: 1.2;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px;
  }

  .editorial-header__slot {
    color: var(--text-primary, #fafafa);
  }

  .editorial-header__divider {
    color: var(--text-muted, #6c6f7a);
    font-weight: 400;
  }

  .editorial-header__date {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-secondary, #b8bac4);
    letter-spacing: -0.01em;
  }

  .editorial-header__time {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-family: var(--font-technical, monospace);
    font-size: 12px;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-header__next {
    color: var(--text-secondary, #b8bac4);
  }

  .editorial-header__next--archived {
    color: rgba(232, 197, 106, 0.85);
  }

  @media (max-width: 640px) {
    .editorial-header { padding: 22px 20px 20px; }
    .editorial-header__title { font-size: 22px; }
    .editorial-header__date { font-size: 15px; }
  }
</style>
