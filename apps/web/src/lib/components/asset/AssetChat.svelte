<script lang="ts">
  import { chatActions, chatStore } from '$lib/stores/chat';
  import Message from '$lib/components/chat/Message.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import OrbMini from '$lib/components/OrbMini.svelte';

  import type { Article } from '@genie/shared';
  import { favoritesStore } from '$lib/stores/favorites';

  export let ticker: string;
  export let price: number;
  export let name: string;
  export let news: Article[] = [];

  $: isFavorited = $favoritesStore.tickers.has(ticker.toUpperCase());

  // Use as chaves do whitelist em apps/api/src/agent/prompt.ts
  // (ALLOWED_CONTEXT_KEYS) — fora delas, o backend descarta silenciosamente.
  $: contextData = {
    ticker_atual: `${ticker}${name ? ` (${name})` : ''}${isFavorited ? ' — favorito do usuário' : ''}`,
    cotacao_atual: `R$ ${price.toFixed(2)}`,
    ...(news.length > 0 ? {
      noticias_do_ativo: news.slice(0, 5)
        .map(a => `- ${a.title}${a.summary ? ': ' + a.summary.slice(0, 100) : ''}`)
        .join('\n'),
    } : {}),
  };

  $: messages = $chatStore.messages;
  $: streaming = $chatStore.streaming;
  $: orbState = $chatStore.orbState;

  async function handleSubmit(event: CustomEvent<{ message: string }>) {
    await chatActions.send(event.detail.message, contextData);
  }
</script>

<div class="asset-chat">
  <div class="asset-chat__header">
    <OrbMini state={orbState} />
    <h2 class="asset-chat__title">Pergunte sobre {ticker}</h2>
  </div>

  <div class="asset-chat__messages" aria-live="polite" aria-label="Histórico do chat">
    {#if messages.length === 0}
      <div class="asset-chat__empty">
        <p>Olá! Posso ajudá-lo com informações sobre <strong>{ticker}</strong>.</p>
        <p class="asset-chat__empty-hint">
          Tente perguntar sobre cotação, fundamentos, dividendos, perspectivas...
        </p>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <Message {message} />
      {/each}
    {/if}
  </div>

  <div class="asset-chat__input">
    <ChatInput
      disabled={streaming}
      placeholder="Ex: Como está {ticker} hoje?"
      on:submit={handleSubmit}
    />
  </div>
</div>

<style>
  .asset-chat {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    height: 600px;
  }

  .asset-chat__header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .asset-chat__title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .asset-chat__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
  }

  .asset-chat__empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-xl);
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  .asset-chat__empty p {
    margin: 0;
  }

  .asset-chat__empty-hint {
    color: var(--text-muted);
    font-size: 13px;
  }

  .asset-chat__input {
    flex-shrink: 0;
  }
</style>
