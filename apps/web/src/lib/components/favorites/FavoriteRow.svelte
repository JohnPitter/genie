<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FavoriteEnriched } from '@genie/shared';

  export let item: FavoriteEnriched;
  /**
   * ISO string of when the user last acknowledged news for this ticker.
   * Stored externally in localStorage by the page.
   */
  export let lastSeenAt: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    remove: { ticker: string };
    navigate: { ticker: string };
  }>();

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Acronym displayed in the avatar circle (up to 4 chars). */
  $: avatarLabel = item.ticker.slice(-4);

  /** True if there are unacknowledged news items. */
  $: hasNewNews = (() => {
    if (!item.lastNewsAt) return false;
    if (!lastSeenAt) return item.newsCount > 0;
    return new Date(item.lastNewsAt) > new Date(lastSeenAt);
  })();

  /** Price change color class. */
  $: changeClass =
    item.quote == null
      ? ''
      : item.quote.changePct >= 0
        ? 'positive'
        : 'negative';

  /** Formatted price. */
  $: priceLabel = item.quote
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quote.price)
    : '—';

  /** Formatted change percentage. */
  $: changeLabel = item.quote
    ? `${item.quote.changePct >= 0 ? '+' : ''}${item.quote.changePct.toFixed(2)}%`
    : null;

  /** Relative date for the latest news article. */
  $: latestNewsDate = (() => {
    const at = item.latestNews?.fetchedAt ?? item.latestNews?.publishedAt;
    if (!at) return null;
    const diff = (Date.now() - new Date(at).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  })();

  function handleRemove() {
    dispatch('remove', { ticker: item.ticker });
  }

  function handleNavigate() {
    dispatch('navigate', { ticker: item.ticker });
  }
</script>

<article class="fav-row">
  <!-- Avatar -->
  <button class="avatar" on:click={handleNavigate} aria-label="Ver {item.ticker}">
    <span class="avatar__label">{avatarLabel}</span>
  </button>

  <!-- Main content -->
  <div class="content">
    <div class="content__header">
      <span class="content__ticker">{item.ticker}</span>
      {#if hasNewNews}
        <span class="badge-new" role="status" aria-label="{item.newsCount} novas notícias">
          🆕 {item.newsCount} nova{item.newsCount !== 1 ? 's' : ''}
        </span>
      {/if}
    </div>

    {#if item.latestNews}
      <p class="content__news-title" title={item.latestNews.title}>
        {item.latestNews.title}
      </p>
      {#if latestNewsDate}
        <span class="content__news-date">{latestNewsDate}</span>
      {/if}
    {:else}
      <p class="content__no-news">Sem notícias recentes</p>
    {/if}
  </div>

  <!-- Price -->
  <div class="price">
    <span class="price__value">{priceLabel}</span>
    {#if changeLabel}
      <span class="price__change price__change--{changeClass}" aria-label="Variação {changeLabel}">
        {changeLabel}
      </span>
    {/if}
  </div>

  <!-- Actions -->
  <div class="actions">
    <button
      class="action-btn action-btn--remove"
      on:click={handleRemove}
      aria-label="Remover {item.ticker} dos favoritos"
      title="Remover dos favoritos"
    >
      ⭐
    </button>
    <button
      class="action-btn action-btn--navigate"
      on:click={handleNavigate}
      aria-label="Ver detalhes de {item.ticker}"
      title="Ver ativo"
    >
      →
    </button>
  </div>
</article>

<style>
  .fav-row {
    display: grid;
    grid-template-columns: 52px 1fr auto auto;
    align-items: center;
    gap: var(--space-md, 12px);
    padding: var(--space-lg, 16px) var(--space-xl, 20px);
    border-bottom: 1px solid var(--border-soft, rgba(255,255,255,0.1));
    transition: background var(--dur-fast, 150ms) ease;
  }

  .fav-row:last-child {
    border-bottom: none;
  }

  .fav-row:hover {
    background: var(--glass-white, rgba(255,255,255,0.04));
  }

  /* ── Avatar ─────────────────────────────────────────────────────── */
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--glass-gold, rgba(207,194,154,0.16));
    border: 1px solid var(--border-strong, rgba(207,194,154,0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform var(--dur-fast, 150ms) ease, box-shadow var(--dur-fast, 150ms) ease;
    flex-shrink: 0;
  }

  .avatar:hover {
    transform: scale(1.06);
    box-shadow: var(--glow-gold, 0 0 16px rgba(207,194,154,0.3));
  }

  .avatar__label {
    font-family: var(--font-technical, 'Space Grotesk', monospace);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-gold, #CFC29A);
    letter-spacing: 0.04em;
  }

  /* ── Content ─────────────────────────────────────────────────────── */
  .content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .content__header {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
  }

  .content__ticker {
    font-family: var(--font-technical, 'Space Grotesk', monospace);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary, #EDEBFF);
    letter-spacing: 0.04em;
  }

  .badge-new {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(232,197,106,0.15);
    color: var(--status-warning, #E8C56A);
    border: 1px solid rgba(232,197,106,0.3);
    white-space: nowrap;
  }

  .content__news-title {
    font-size: 13px;
    color: var(--text-secondary, #B7B9C9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    max-width: 360px;
  }

  .content__news-date {
    font-size: 11px;
    color: var(--text-muted, #8B8D9A);
  }

  .content__no-news {
    font-size: 13px;
    color: var(--text-muted, #8B8D9A);
    font-style: italic;
    margin: 0;
  }

  /* ── Price ───────────────────────────────────────────────────────── */
  .price {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    min-width: 88px;
  }

  .price__value {
    font-family: var(--font-technical, 'Space Grotesk', monospace);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #EDEBFF);
  }

  .price__change {
    font-family: var(--font-technical, 'Space Grotesk', monospace);
    font-size: 12px;
    font-weight: 500;
  }

  .price__change--positive { color: var(--status-success, #7ED6A7); }
  .price__change--negative { color: var(--status-error, #F07C7C); }

  /* ── Actions ─────────────────────────────────────────────────────── */
  .actions {
    display: flex;
    gap: var(--space-sm, 8px);
    align-items: center;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--dur-fast, 150ms) ease, transform var(--dur-fast, 150ms) ease;
    color: var(--text-secondary, #B7B9C9);
  }

  .action-btn:hover {
    background: var(--glass-white, rgba(255,255,255,0.08));
    transform: scale(1.1);
  }

  .action-btn:active {
    transform: scale(0.95);
  }

  .action-btn--remove:hover {
    color: var(--accent-gold, #CFC29A);
  }

  .action-btn--navigate {
    font-size: 18px;
    color: var(--accent-lilac, #A79BFF);
  }

  .action-btn--navigate:hover {
    background: var(--glass-lilac, rgba(167,155,255,0.14));
    color: var(--text-primary, #EDEBFF);
  }
</style>
