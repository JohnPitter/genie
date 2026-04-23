<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Send, Loader2 } from 'lucide-svelte';

  export let placeholder = 'Pergunte sobre qualquer ação da B3...';
  export let disabled = false;
  export let loading = false;

  const dispatch = createEventDispatcher<{ submit: { message: string } }>();

  let value = '';
  let textareaEl: HTMLTextAreaElement;

  const MAX_ROWS = 4;
  const LINE_HEIGHT = 22; // px, matches CSS line-height

  $: isDisabled = disabled || loading;
  $: canSubmit = value.trim().length > 0 && !isDisabled;

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    dispatch('submit', { message: trimmed });
    value = '';
    resetHeight();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput() {
    autoGrow();
  }

  function autoGrow() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16; // 16px extra padding
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, maxHeight) + 'px';
  }

  function resetHeight() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
  }
</script>

<form
  class="chat-input"
  on:submit|preventDefault={submit}
  aria-label="Formulário de chat"
>
  <textarea
    bind:this={textareaEl}
    bind:value
    class="chat-input__textarea"
    {placeholder}
    disabled={isDisabled}
    rows={1}
    aria-label="Mensagem para o Genie"
    aria-multiline="true"
    on:keydown={handleKeydown}
    on:input={handleInput}
  ></textarea>

  <button
    type="submit"
    class="chat-input__send"
    class:chat-input__send--active={canSubmit}
    disabled={!canSubmit}
    aria-label="Enviar mensagem"
    aria-busy={loading}
  >
    {#if loading}
      <span class="chat-input__spinner" aria-hidden="true">
        <Loader2 size={18} />
      </span>
    {:else}
      <Send size={18} aria-hidden="true" />
    {/if}
  </button>
</form>

<style>
  .chat-input {
    display: flex;
    align-items: flex-end;
    gap: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-xl);
    transition:
      border-color var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
    overflow: hidden;
  }

  .chat-input:focus-within {
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 3px rgba(167, 155, 255, 0.12);
  }

  .chat-input__textarea {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    padding: var(--space-lg) var(--space-xl);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-primary);
    line-height: 22px;
    overflow-y: hidden;
    /* Scrollbar only appears when at max height */
    max-height: calc(22px * 4 + 16px);
    overflow-y: auto;
  }

  .chat-input__textarea::placeholder {
    color: var(--text-muted);
  }

  .chat-input__textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-input__send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: var(--space-xs);
    border-radius: var(--radius-md);
    border: none;
    background: var(--glass-white);
    color: var(--text-muted);
    cursor: not-allowed;
    flex-shrink: 0;
    transition:
      background var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      transform var(--dur-fast) var(--ease-standard);
  }

  .chat-input__send--active {
    background: var(--glass-lilac);
    color: var(--accent-lilac);
    cursor: pointer;
  }

  .chat-input__send--active:hover {
    background: var(--accent-violet);
    color: var(--text-primary);
    transform: scale(1.05);
  }

  .chat-input__send--active:active {
    transform: scale(0.96);
  }

  .chat-input__send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .chat-input__send--active:disabled {
    opacity: 1;
    pointer-events: none;
  }

  .chat-input__spinner {
    display: flex;
    align-items: center;
    animation: spin 1s linear infinite;
    color: var(--accent-lilac);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-input__spinner {
      animation: none;
    }
  }
</style>
