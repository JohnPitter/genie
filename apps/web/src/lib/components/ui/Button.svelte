<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'ghost' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(event: MouseEvent) {
    if (!disabled && !loading) {
      dispatch('click', event);
    }
  }
</script>

<button
  class="btn btn--{variant} btn--{size}"
  class:btn--loading={loading}
  {disabled}
  aria-busy={loading}
  aria-disabled={disabled}
  on:click={handleClick}
>
  {#if loading}
    <span class="btn__spinner" aria-hidden="true"></span>
  {/if}
  <slot />
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-weight: 500;
    cursor: pointer;
    transition:
      transform var(--dur-medium) var(--ease-standard),
      box-shadow var(--dur-medium) var(--ease-standard),
      border-color var(--dur-medium) var(--ease-standard);
    white-space: nowrap;
    text-decoration: none;
    outline: none;
  }

  /* ── Sizes ─────────────────────────────────────────────────── */
  .btn--sm { padding: 8px 14px; font-size: var(--text-micro); }
  .btn--md { padding: 12px 20px; font-size: var(--text-caption); }
  .btn--lg { padding: 16px 28px; font-size: var(--text-body); }

  /* ── Primary: dark bg + gold border + violet glow on hover ── */
  .btn--primary {
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid rgba(207, 194, 154, 0.5);
    box-shadow: 0 0 18px rgba(167, 155, 255, 0.12);
  }
  .btn--primary:hover:not(:disabled):not(.btn--loading) {
    border-color: rgba(237, 235, 255, 0.4);
    box-shadow: var(--glow-violet);
    transform: translateY(-2px);
  }
  .btn--primary:active:not(:disabled):not(.btn--loading) {
    transform: scale(0.98);
  }
  .btn--primary:focus-visible {
    box-shadow: 0 0 0 2px var(--accent-lilac);
  }

  /* ── Ghost: transparent + border shows on hover ─────────── */
  .btn--ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid transparent;
  }
  .btn--ghost:hover:not(:disabled):not(.btn--loading) {
    background: var(--glass-white);
    border-color: var(--border-soft);
    color: var(--text-primary);
    transform: translateY(-2px);
  }
  .btn--ghost:active:not(:disabled):not(.btn--loading) {
    transform: scale(0.98);
  }
  .btn--ghost:focus-visible {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.2);
  }

  /* ── Danger: red border + muted red glow ─────────────────── */
  .btn--danger {
    background: rgba(240, 124, 124, 0.08);
    color: var(--status-error);
    border: 1px solid rgba(240, 124, 124, 0.4);
  }
  .btn--danger:hover:not(:disabled):not(.btn--loading) {
    background: rgba(240, 124, 124, 0.14);
    border-color: rgba(240, 124, 124, 0.7);
    box-shadow: 0 0 18px rgba(240, 124, 124, 0.25);
    transform: translateY(-2px);
  }
  .btn--danger:active:not(:disabled):not(.btn--loading) {
    transform: scale(0.98);
  }
  .btn--danger:focus-visible {
    box-shadow: 0 0 0 2px rgba(240, 124, 124, 0.35);
  }

  /* ── Disabled + loading ───────────────────────────────────── */
  .btn:disabled,
  .btn--loading {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Spinner for loading state */
  .btn__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: btn-spin 600ms linear infinite;
  }

  @keyframes btn-spin {
    to { transform: rotate(360deg); }
  }
</style>
