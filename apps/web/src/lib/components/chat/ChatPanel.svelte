<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { X, RotateCcw } from 'lucide-svelte';
  import Message from './Message.svelte';
  import ChatInput from './ChatInput.svelte';
  import { chatStore, chatActions } from '$lib/stores/chat';
  import type { ChatActions } from '$lib/stores/chat';

  export let mode: 'inline' | 'overlay' = 'inline';
  export let compact = false;
  export let onClose: (() => void) | undefined = undefined;
  /** Injected actions for testing */
  export let actions: ChatActions = chatActions;

  let messagesEl: HTMLDivElement;

  $: messages = $chatStore.messages;
  $: streaming = $chatStore.streaming;
  $: orbState = $chatStore.orbState;

  async function handleSubmit(event: CustomEvent<{ message: string }>) {
    await actions.send(event.detail.message);
  }

  function handleClear() {
    actions.clear();
  }

  // Auto-scroll to bottom when messages change or content streams in
  $: if (messages) {
    tick().then(scrollToBottom);
  }

  function scrollToBottom() {
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  onMount(scrollToBottom);
</script>

{#if mode === 'overlay'}
  <div
    class="chat-panel__backdrop"
    role="presentation"
    on:click={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose?.()}
  ></div>
{/if}

<div
  class="chat-panel"
  class:chat-panel--inline={mode === 'inline'}
  class:chat-panel--overlay={mode === 'overlay'}
  class:chat-panel--compact={compact}
  role="region"
  aria-label="Chat com Genie"
>
  <!-- Header -->
  <div class="chat-panel__header">
    <div class="chat-panel__header-info">
      <span class="chat-panel__title">Genie</span>
      <span class="chat-panel__subtitle">
        {#if streaming}
          pensando...
        {:else if orbState === 'idle'}
          pronto para ajudar
        {:else if orbState === 'listening'}
          ouvindo...
        {:else if orbState === 'speaking'}
          respondendo...
        {:else if orbState === 'error'}
          erro
        {:else}
          assistente financeiro
        {/if}
      </span>
    </div>

    <div class="chat-panel__header-actions">
      <button
        class="chat-panel__action-btn"
        on:click={handleClear}
        aria-label="Nova conversa"
        title="Nova conversa"
      >
        <RotateCcw size={16} />
      </button>

      {#if mode === 'overlay' && onClose}
        <button
          class="chat-panel__action-btn"
          on:click={onClose}
          aria-label="Fechar chat"
          title="Fechar"
        >
          <X size={16} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Messages -->
  <div
    class="chat-panel__messages"
    bind:this={messagesEl}
    aria-live="polite"
    aria-label="Histórico de conversa"
  >
    {#if messages.length === 0}
      <div class="chat-panel__empty">
        <p class="chat-panel__empty-text">
          Pergunte sobre qualquer ativo da B3 — cotações, notícias, fundamentos.
        </p>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <Message {message} />
      {/each}
    {/if}
  </div>

  <!-- Footer / Input -->
  <div class="chat-panel__footer">
    <ChatInput
      loading={streaming}
      on:submit={handleSubmit}
    />
  </div>
</div>

<style>
  /* ── Backdrop (overlay mode) ──────────────────────── */
  .chat-panel__backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 5, 7, 0.6);
    backdrop-filter: blur(4px);
    z-index: 90;
    animation: fade-in var(--dur-medium) var(--ease-standard);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Panel base ───────────────────────────────────── */
  .chat-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  /* ── Inline mode ──────────────────────────────────── */
  .chat-panel--inline {
    width: 100%;
    height: 100%;
  }

  /* ── Overlay mode ─────────────────────────────────── */
  .chat-panel--overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, 90vw);
    height: min(560px, 80vh);
    z-index: 100;
    box-shadow: var(--shadow-card), var(--glow-violet);
    animation: panel-in var(--dur-smooth) var(--ease-standard);
  }

  @keyframes panel-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  /* ── Compact mode ─────────────────────────────────── */
  .chat-panel--compact .chat-panel__header {
    padding: var(--space-sm) var(--space-md);
  }
  .chat-panel--compact .chat-panel__messages {
    padding: var(--space-sm) var(--space-md);
  }
  .chat-panel--compact .chat-panel__footer {
    padding: var(--space-sm) var(--space-md);
  }

  /* ── Header ───────────────────────────────────────── */
  .chat-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-xl);
    border-bottom: 1px solid var(--border-soft);
    flex-shrink: 0;
  }

  .chat-panel__header-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chat-panel__title {
    font-family: var(--font-display);
    font-size: var(--text-caption);
    font-weight: 600;
    color: var(--text-primary);
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .chat-panel__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-micro);
    color: var(--text-muted);
    font-style: italic;
  }

  .chat-panel__header-actions {
    display: flex;
    gap: var(--space-xs);
  }

  .chat-panel__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard);
  }

  .chat-panel__action-btn:hover {
    background: var(--glass-white);
    border-color: var(--border-soft);
    color: var(--text-primary);
  }

  .chat-panel__action-btn:focus-visible {
    outline: none;
    border-color: var(--border-interactive);
    box-shadow: 0 0 0 2px rgba(167, 155, 255, 0.2);
  }

  /* ── Messages ─────────────────────────────────────── */
  .chat-panel__messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    scroll-behavior: smooth;
  }

  .chat-panel__messages::-webkit-scrollbar {
    width: 4px;
  }
  .chat-panel__messages::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-panel__messages::-webkit-scrollbar-thumb {
    background: var(--border-soft);
    border-radius: 2px;
  }

  /* ── Empty state ──────────────────────────────────── */
  .chat-panel__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: var(--space-2xl);
  }

  .chat-panel__empty-text {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    text-align: center;
    line-height: 1.6;
    margin: 0;
  }

  /* ── Footer ───────────────────────────────────────── */
  .chat-panel__footer {
    padding: var(--space-md) var(--space-xl);
    border-top: 1px solid var(--border-soft);
    flex-shrink: 0;
  }
</style>
