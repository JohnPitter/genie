<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import { favoritesStore, favoritesActions } from '$lib/stores/favorites';
  import FavoriteRow from '$lib/components/favorites/FavoriteRow.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  export let data: PageData;

  // ── Local state ───────────────────────────────────────────────────

  /** ISO timestamps of last seen news per ticker — persisted in localStorage. */
  let lastSeenMap: Record<string, string> = {};

  /** Whether we're refreshing. */
  let refreshing = false;

  /** Toast message shown briefly after an action. */
  let toastMessage = '';
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Store ────────────────────────────────────────────────────────

  $: items = $favoritesStore.items.length > 0 ? $favoritesStore.items : data.items;
  $: loading = $favoritesStore.loading;
  $: count = items.length;

  // ── Lifecycle ────────────────────────────────────────────────────

  onMount(() => {
    // Seed the store with SSR data to avoid an extra fetch.
    if (data.items.length > 0 && $favoritesStore.items.length === 0) {
      // Initialize store with SSR items (they are already enriched).
      favoritesActions.load(true);
    }

    // Load lastSeen timestamps from localStorage.
    try {
      const raw = localStorage.getItem('genie:lastSeenNews');
      if (raw) lastSeenMap = JSON.parse(raw);
    } catch {
      lastSeenMap = {};
    }
  });

  // ── Handlers ─────────────────────────────────────────────────────

  async function handleRemove(ticker: string) {
    await favoritesActions.remove(ticker);
    showToast(`${ticker} removido dos favoritos`);
  }

  function handleNavigate(ticker: string) {
    // Mark news as seen for this ticker.
    lastSeenMap = { ...lastSeenMap, [ticker]: new Date().toISOString() };
    try {
      localStorage.setItem('genie:lastSeenNews', JSON.stringify(lastSeenMap));
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
    goto(`/asset/${ticker}`);
  }

  async function handleRefresh() {
    refreshing = true;
    try {
      // Invalidate cache by resetting lastLoadedAt — next load() will refetch.
      await favoritesActions.load(true);
      showToast('Favoritos atualizados');
    } finally {
      refreshing = false;
    }
  }

  function showToast(message: string) {
    toastMessage = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage = '';
    }, 3000);
  }
</script>

<svelte:head>
  <title>Meus Favoritos — Genie</title>
  <meta name="description" content="Acompanhe cotações e notícias dos seus ativos B3 favoritos em tempo real com o Genie." />
  <meta property="og:title" content="Meus Favoritos — Genie" />
  <meta property="og:description" content="Acompanhe cotações e notícias dos seus ativos B3 favoritos em tempo real com o Genie." />
</svelte:head>

<main class="page">
  <!-- ── Header ─────────────────────────────────────────────────── -->
  <header class="page__header">
    <div class="page__title-row">
      <h1 class="page__title">Meus Favoritos</h1>
      {#if count > 0}
        <Badge variant="gold" size="md">{count} favoritado{count !== 1 ? 's' : ''}</Badge>
      {/if}
    </div>
    <p class="page__subtitle">
      Acompanhe cotações e notícias das suas ações favoritadas em tempo real.
    </p>
  </header>

  <!-- ── Content ────────────────────────────────────────────────── -->
  {#if loading}
    <!-- Skeleton list -->
    <div class="skeleton-list">
      {#each { length: 3 } as _}
        <div class="skeleton-row">
          <Skeleton width="48px" height="48px" rounded="full" />
          <div class="skeleton-text">
            <Skeleton width="80px" height="16px" />
            <Skeleton width="200px" height="13px" />
          </div>
          <Skeleton width="88px" height="20px" />
        </div>
      {/each}
    </div>

  {:else if items.length === 0}
    <!-- Empty state -->
    <div class="empty-state" role="status">
      <div class="empty-state__orb" aria-hidden="true">⭐</div>
      <h2 class="empty-state__title">Nenhuma ação favorita</h2>
      <p class="empty-state__body">
        Você ainda não favoritou nenhuma ação.
        Busque uma no chat da home para começar.
      </p>
      <a href="/" class="empty-state__cta">Ir para a home</a>
    </div>

  {:else}
    <!-- Favorites list -->
    <div class="favorites-list" role="list">
      {#each items as item (item.ticker)}
        <div role="listitem" class="fav-list-item" class:fav-list-item--removing={false}>
          <FavoriteRow
            {item}
            lastSeenAt={lastSeenMap[item.ticker]}
            on:remove={(e) => handleRemove(e.detail.ticker)}
            on:navigate={(e) => handleNavigate(e.detail.ticker)}
          />
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Footer ─────────────────────────────────────────────────── -->
  {#if items.length > 0}
    <footer class="page__footer">
      <button
        class="refresh-btn"
        on:click={handleRefresh}
        disabled={refreshing || loading}
        aria-busy={refreshing}
      >
        {#if refreshing}
          <span class="refresh-btn__spinner" aria-hidden="true"></span>
          Atualizando…
        {:else}
          ↺ Atualizar agora
        {/if}
      </button>
    </footer>
  {/if}
</main>

<!-- ── Toast ─────────────────────────────────────────────────────── -->
{#if toastMessage}
  <div class="toast" role="status" aria-live="polite">
    {toastMessage}
  </div>
{/if}

<style>
  .page {
    padding: var(--space-4xl, 40px) var(--space-xl, 20px);
    max-width: 900px;
    margin: 0 auto;
    min-height: 100vh;
  }

  /* ── Header ────────────────────────────────────────────────────── */
  .page__header {
    margin-bottom: var(--space-2xl, 32px);
  }

  .page__title-row {
    display: flex;
    align-items: center;
    gap: var(--space-md, 12px);
    margin-bottom: var(--space-sm, 8px);
    flex-wrap: wrap;
  }

  .page__title {
    font-family: var(--font-display, 'Sora', system-ui);
    font-size: var(--text-h2, 28px);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    background: var(--gradient-brand, linear-gradient(135deg, #CFC29A, #A79BFF, #EDEBFF));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .page__subtitle {
    font-size: var(--text-caption, 13px);
    color: var(--text-muted, #8B8D9A);
    margin: 0;
  }

  /* ── Skeleton list ─────────────────────────────────────────────── */
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg, 16px);
  }

  .skeleton-row {
    display: grid;
    grid-template-columns: 48px 1fr 88px;
    align-items: center;
    gap: var(--space-md, 12px);
    padding: var(--space-lg, 16px) 0;
    border-bottom: 1px solid var(--border-soft, rgba(255,255,255,0.08));
  }

  .skeleton-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── Empty state ───────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-4xl, 56px) var(--space-xl, 24px);
    gap: var(--space-lg, 16px);
  }

  .empty-state__orb {
    font-size: 64px;
    filter: grayscale(0.5);
    animation: float 3s ease-in-out infinite alternate;
  }

  .empty-state__title {
    font-family: var(--font-display, 'Sora', system-ui);
    font-size: var(--text-h3, 22px);
    font-weight: 600;
    color: var(--text-primary, #EDEBFF);
    margin: 0;
  }

  .empty-state__body {
    font-size: var(--text-body, 14px);
    color: var(--text-secondary, #B7B9C9);
    max-width: 360px;
    line-height: 1.6;
    margin: 0;
  }

  .empty-state__cta {
    display: inline-flex;
    align-items: center;
    padding: 10px 24px;
    border-radius: var(--radius-md, 16px);
    border: 1px solid rgba(207,194,154,0.4);
    background: var(--glass-gold, rgba(207,194,154,0.08));
    color: var(--accent-gold, #CFC29A);
    font-size: var(--text-caption, 13px);
    font-weight: 500;
    text-decoration: none;
    transition: background var(--dur-fast, 150ms) ease, box-shadow var(--dur-fast, 150ms) ease;
  }

  .empty-state__cta:hover {
    background: rgba(207,194,154,0.16);
    box-shadow: var(--glow-gold, 0 0 16px rgba(207,194,154,0.2));
  }

  @keyframes float {
    from { transform: translateY(0); }
    to   { transform: translateY(-10px); }
  }

  /* ── Favorites list ────────────────────────────────────────────── */
  .favorites-list {
    border-radius: var(--radius-lg, 20px);
    border: 1px solid var(--border-soft, rgba(255,255,255,0.1));
    background: linear-gradient(180deg, #17181D 0%, #111217 100%);
    overflow: hidden;
    box-shadow: var(--shadow-card, 0 12px 40px rgba(0,0,0,0.38));
  }

  .fav-list-item {
    transition: opacity var(--dur-medium, 280ms) ease, transform var(--dur-medium, 280ms) ease;
  }

  /* ── Footer ────────────────────────────────────────────────────── */
  .page__footer {
    margin-top: var(--space-2xl, 28px);
    display: flex;
    justify-content: center;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    padding: 10px 24px;
    border-radius: var(--radius-md, 16px);
    border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
    background: transparent;
    color: var(--text-secondary, #B7B9C9);
    font-size: var(--text-caption, 13px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--dur-fast, 150ms) ease, color var(--dur-fast, 150ms) ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--glass-white, rgba(255,255,255,0.06));
    color: var(--text-primary, #EDEBFF);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn__spinner {
    width: 13px;
    height: 13px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Toast ──────────────────────────────────────────────────────── */
  .toast {
    position: fixed;
    bottom: var(--space-2xl, 28px);
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 24px;
    border-radius: var(--radius-md, 16px);
    background: var(--bg-elevated, #1C1D24);
    border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
    color: var(--text-primary, #EDEBFF);
    font-size: var(--text-caption, 13px);
    box-shadow: var(--shadow-card, 0 12px 40px rgba(0,0,0,0.38));
    animation: toast-in var(--dur-medium, 280ms) var(--ease-standard, cubic-bezier(0.22,1,0.36,1));
    z-index: 9999;
    white-space: nowrap;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
