<script lang="ts">
  export let variant: 'default' | 'glass' | 'elevated' = 'default';
  export let padding: 'sm' | 'md' | 'lg' = 'md';
  export let hoverable = false;
</script>

<div
  class="card card--{variant} card--pad-{padding}"
  class:card--hoverable={hoverable}
>
  <slot />
</div>

<style>
  .card {
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    position: relative;
    overflow: hidden;
  }

  /* ── Padding ─────────────────────────────────────────────── */
  .card--pad-sm { padding: var(--space-lg); }
  .card--pad-md { padding: var(--space-xl); }
  .card--pad-lg { padding: var(--space-2xl); }

  /* ── Default: technical card with gradient bg + gold border ── */
  .card--default {
    background: linear-gradient(180deg, #17181D 0%, #111217 100%);
    border: 1px solid var(--border-soft);
  }
  /* Pseudo-element carries the gradient border (gold→lilac) */
  .card--default::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: var(--gradient-border-premium);
    /* Mask so only the border shows, not the fill */
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* ── Glass: translucent with blur ───────────────────────── */
  .card--glass {
    background: var(--gradient-surface-glass);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
    border: 1px solid var(--border-soft);
  }

  /* ── Elevated: higher contrast, stronger shadow ─────────── */
  .card--elevated {
    background: var(--bg-elevated);
    border: 1px solid var(--border-interactive);
    box-shadow: var(--shadow-hover);
  }

  /* ── Hoverable lift ─────────────────────────────────────── */
  .card--hoverable {
    transition:
      transform var(--dur-medium) var(--ease-standard),
      box-shadow var(--dur-medium) var(--ease-standard);
    cursor: default;
  }
  .card--hoverable:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-hover);
  }
</style>
