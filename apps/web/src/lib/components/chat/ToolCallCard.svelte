<script lang="ts">
  import { Wrench, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { RenderedToolCall } from '$lib/stores/chat';

  export let call: RenderedToolCall;

  $: statusVariant = (
    call.status === 'done' ? 'success' :
    call.status === 'error' ? 'error' :
    'info'
  ) as 'success' | 'error' | 'info';

  $: statusLabel =
    call.status === 'done' ? 'concluído' :
    call.status === 'error' ? 'erro' :
    'executando';

  $: durationLabel = call.durationMs !== undefined ? `${call.durationMs}ms` : '';
</script>

<details
  class="tool-card"
  class:tool-card--running={call.status === 'running'}
  open={call.status === 'error'}
>
  <summary
    class="tool-card__header"
    aria-label={`Ferramenta: ${call.name}, status: ${statusLabel}`}
  >
    <span class="tool-card__icon" aria-hidden="true">
      <Wrench size={14} />
    </span>
    <span class="tool-card__name">{call.name}</span>
    <span class="tool-card__badges">
      <Badge variant={statusVariant} size="sm">{statusLabel}</Badge>
      {#if durationLabel}
        <span class="tool-card__duration">{durationLabel}</span>
      {/if}
    </span>
    {#if call.status === 'running'}
      <span class="tool-card__spinner" aria-hidden="true">
        <Loader2 size={12} />
      </span>
    {:else if call.status === 'done'}
      <span class="tool-card__status-icon" aria-hidden="true">
        <CheckCircle2 size={12} />
      </span>
    {:else if call.status === 'error'}
      <span class="tool-card__status-icon tool-card__status-icon--error" aria-hidden="true">
        <AlertCircle size={12} />
      </span>
    {/if}
    <span class="tool-card__chevron" aria-hidden="true">
      <ChevronDown size={12} />
    </span>
  </summary>

  <div class="tool-card__body">
    <div class="tool-card__section">
      <span class="tool-card__section-label">Parâmetros:</span>
      <pre class="tool-card__json">{JSON.stringify(call.args, null, 2)}</pre>
    </div>

    {#if call.result !== undefined}
      <div class="tool-card__section">
        <span class="tool-card__section-label">Resultado:</span>
        <pre class="tool-card__json tool-card__json--result">{JSON.stringify(call.result, null, 2)}</pre>
      </div>
    {/if}
  </div>
</details>

<style>
  .tool-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    margin: var(--space-sm) 0;
    overflow: hidden;
    transition: border-color var(--dur-fast) var(--ease-standard);
  }

  .tool-card--running {
    border-color: var(--border-interactive);
    animation: tool-pulse 1.5s ease-in-out infinite alternate;
  }

  @keyframes tool-pulse {
    from { box-shadow: 0 0 0 0 transparent; }
    to   { box-shadow: 0 0 8px 2px rgba(167, 155, 255, 0.15); }
  }

  .tool-card__header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .tool-card__header::-webkit-details-marker {
    display: none;
  }

  .tool-card__header:hover {
    background: var(--glass-white);
  }

  .tool-card__icon {
    color: var(--accent-gold);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .tool-card__name {
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    color: var(--text-primary);
    font-weight: 500;
    flex: 1;
  }

  .tool-card__badges {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .tool-card__duration {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
  }

  .tool-card__spinner {
    color: var(--accent-lilac);
    display: flex;
    align-items: center;
    animation: spin 1s linear infinite;
  }

  .tool-card__status-icon {
    display: flex;
    align-items: center;
    color: var(--status-success);
  }

  .tool-card__status-icon--error {
    color: var(--status-error);
  }

  .tool-card__chevron {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    transition: transform var(--dur-fast) var(--ease-standard);
  }

  details[open] .tool-card__chevron {
    transform: rotate(180deg);
  }

  .tool-card__body {
    padding: var(--space-sm) var(--space-md) var(--space-md);
    border-top: 1px solid var(--border-soft);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .tool-card__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .tool-card__section-label {
    font-family: var(--font-technical);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .tool-card__json {
    font-family: var(--font-technical);
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
    margin: 0;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-card__json--result {
    color: var(--accent-gold);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .tool-card--running {
      animation: none;
    }
    .tool-card__spinner {
      animation: none;
    }
  }
</style>
