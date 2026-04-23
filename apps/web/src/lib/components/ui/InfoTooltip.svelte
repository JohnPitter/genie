<script lang="ts">
  import { HelpCircle } from 'lucide-svelte';

  export let text: string = '';
  export let size: number = 13;
  /** CSS width of the tooltip bubble. Default 240px. */
  export let width: string = '240px';
</script>

<span class="tip" tabindex="0" aria-label={text}>
  <HelpCircle size={size} aria-hidden="true" />
  <span class="tip__bubble" style="--w: {width}" role="tooltip">
    {text}
  </span>
</span>

<style>
  .tip {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
    cursor: help;
    vertical-align: middle;
    outline: none;
  }

  .tip:hover,
  .tip:focus-visible {
    color: var(--accent-lilac);
  }

  .tip__bubble {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translateX(-50%) translateY(4px) scale(0.96);
    width: var(--w, 240px);
    padding: 10px 12px;
    background: #1a1825;
    border: 1px solid rgba(167, 155, 255, 0.35);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--text-secondary);
    text-align: left;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.18s ease-out,
      transform 0.18s ease-out;
    z-index: 100;
    white-space: normal;
  }

  .tip__bubble::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 8px;
    height: 8px;
    background: #1a1825;
    border-right: 1px solid rgba(167, 155, 255, 0.35);
    border-bottom: 1px solid rgba(167, 155, 255, 0.35);
    transform: translateX(-50%) translateY(-4px) rotate(45deg);
  }

  .tip:hover .tip__bubble,
  .tip:focus-visible .tip__bubble {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }

  /* Mobile: tooltip à direita se muito perto da esquerda */
  @media (max-width: 600px) {
    .tip__bubble {
      width: 200px;
    }
  }
</style>
