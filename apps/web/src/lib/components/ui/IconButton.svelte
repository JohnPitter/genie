<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label: string;
  export let size: 16 | 20 | 24 = 20;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  const sizeMap: Record<number, string> = {
    16: '28px',
    20: '36px',
    24: '44px',
  };

  $: btnSize = sizeMap[size];

  function handleClick(event: MouseEvent) {
    if (!disabled) dispatch('click', event);
  }
</script>

<button
  class="icon-btn"
  style="width: {btnSize}; height: {btnSize};"
  aria-label={label}
  {disabled}
  on:click={handleClick}
>
  <span class="icon-btn__icon" style="width: {size}px; height: {size}px;">
    <slot />
  </span>
</button>

<style>
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      transform var(--dur-fast) var(--ease-standard);
    flex-shrink: 0;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--glass-white);
    border-color: var(--border-soft);
    color: var(--text-primary);
    transform: translateY(-1px);
  }

  .icon-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .icon-btn:focus-visible {
    outline: none;
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.2);
  }

  .icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .icon-btn__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
</style>
