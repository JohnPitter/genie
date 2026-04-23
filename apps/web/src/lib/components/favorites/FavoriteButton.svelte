<script lang="ts">
  import { favoritesStore, favoritesActions } from '$lib/stores/favorites';

  export let ticker: string;
  export let size: 'sm' | 'md' = 'md';

  let toggling = false;

  $: isFavorite = $favoritesStore.tickers.has(ticker.toUpperCase());

  async function handleClick() {
    if (toggling) return;
    toggling = true;
    try {
      await favoritesActions.toggle(ticker);
    } finally {
      toggling = false;
    }
  }
</script>

<button
  class="fav-btn fav-btn--{size}"
  class:fav-btn--active={isFavorite}
  class:fav-btn--loading={toggling}
  on:click={handleClick}
  disabled={toggling}
  aria-pressed={isFavorite}
  aria-label={isFavorite ? `Remover ${ticker} dos favoritos` : `Adicionar ${ticker} aos favoritos`}
  title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
>
  {#if toggling}
    <span class="spinner" aria-hidden="true"></span>
  {:else}
    <svg
      class="star-icon"
      viewBox="0 0 24 24"
      fill={isFavorite ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  {/if}
</button>

<style>
  .fav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
    background: transparent;
    cursor: pointer;
    color: var(--text-muted, #8B8D9A);
    transition:
      color var(--dur-fast, 150ms) ease,
      background var(--dur-fast, 150ms) ease,
      transform var(--dur-fast, 150ms) ease,
      box-shadow var(--dur-fast, 150ms) ease;
  }

  /* ── Sizes ───────────────────────────────────────────────────────── */
  .fav-btn--sm {
    width: 32px;
    height: 32px;
  }

  .fav-btn--md {
    width: 40px;
    height: 40px;
  }

  .star-icon {
    transition: fill var(--dur-fast, 150ms) ease;
  }

  .fav-btn--sm .star-icon { width: 16px; height: 16px; }
  .fav-btn--md .star-icon { width: 20px; height: 20px; }

  /* ── Unfavorited hover ───────────────────────────────────────────── */
  .fav-btn:hover:not(:disabled):not(.fav-btn--loading) {
    background: var(--glass-gold, rgba(207,194,154,0.12));
    color: var(--accent-gold, #CFC29A);
    transform: scale(1.08);
  }

  .fav-btn:active:not(:disabled):not(.fav-btn--loading) {
    transform: scale(0.94);
  }

  .fav-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent-lilac, #A79BFF);
  }

  /* ── Active (favorited) state ────────────────────────────────────── */
  .fav-btn--active {
    color: var(--accent-gold, #CFC29A);
    border-color: var(--border-strong, rgba(207,194,154,0.35));
    background: var(--glass-gold, rgba(207,194,154,0.12));
    box-shadow: var(--glow-gold, 0 0 12px rgba(207,194,154,0.2));
  }

  .fav-btn--active:hover:not(:disabled):not(.fav-btn--loading) {
    color: var(--status-error, #F07C7C);
    background: rgba(240,124,124,0.08);
    border-color: rgba(240,124,124,0.3);
    box-shadow: none;
  }

  /* ── Loading / disabled ──────────────────────────────────────────── */
  .fav-btn--loading,
  .fav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ── Spinner ─────────────────────────────────────────────────────── */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
