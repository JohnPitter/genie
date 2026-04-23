<script lang="ts">
  export let variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'gold' = 'neutral';
  export let size: 'sm' | 'md' = 'md';
</script>

<span class="badge badge--{variant} badge--{size}">
  <slot />
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-full);
    font-family: var(--font-technical);
    font-weight: 500;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  /* ── Sizes ─────────────────────────────────────────────────── */
  .badge--sm {
    padding: 2px 10px;
    font-size: var(--text-micro);
  }
  .badge--md {
    padding: 4px 14px;
    font-size: var(--text-caption);
  }

  /* ── Variants ───────────────────────────────────────────────── */
  .badge--success {
    background: rgba(126, 214, 167, 0.15);
    color: var(--status-success);
    border: 1px solid rgba(126, 214, 167, 0.3);
  }
  .badge--warning {
    background: rgba(232, 197, 106, 0.15);
    color: var(--status-warning);
    border: 1px solid rgba(232, 197, 106, 0.3);
  }
  .badge--error {
    background: rgba(240, 124, 124, 0.15);
    color: var(--status-error);
    border: 1px solid rgba(240, 124, 124, 0.3);
  }
  .badge--info {
    background: rgba(140, 184, 255, 0.15);
    color: var(--status-info);
    border: 1px solid rgba(140, 184, 255, 0.3);
  }
  .badge--neutral {
    background: var(--glass-white);
    color: var(--text-secondary);
    border: 1px solid var(--border-soft);
  }
  .badge--gold {
    background: var(--glass-gold);
    color: var(--accent-gold);
    border: 1px solid var(--border-strong);
  }
</style>
