<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import OrbMini from '$lib/components/OrbMini.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { renderMarkdown } from '$lib/utils/markdown';
  import { chatActions, chatStore } from '$lib/stores/chat';
  import type { ChatMessage } from '$lib/stores/chat';

  export let message: ChatMessage;

  $: streaming = $chatStore.streaming;

  function handleRetry() {
    if (streaming) return;
    chatActions.retry();
  }

  $: isUser = message.role === 'user';
  $: isStreaming = message.status === 'streaming';
  $: hasError = message.status === 'error';
  $: orbState = (isStreaming ? 'speaking' : 'idle') as 'speaking' | 'idle';
  $: renderedContent = renderMarkdown(message.content);

  // Show tool activity only while streaming
  $: runningTools = (message.toolCalls ?? []).filter((c) => c.status === 'running');
  $: showToolActivity = isStreaming && runningTools.length > 0;

  // Map tool name → { icon (emoji), label }
  const TOOL_META: Record<string, { icon: string; label: string }> = {
    b3_quote:         { icon: '📈', label: 'Buscando cotação' },
    b3_fundamentals:  { icon: '🔎', label: 'Analisando fundamentos' },
    b3_search_ticker: { icon: '🔍', label: 'Procurando ativo' },
    web_search:       { icon: '🌐', label: 'Pesquisando na web' },
    web_fetch:        { icon: '📄', label: 'Lendo artigo' },
    favorite_add:     { icon: '⭐', label: 'Adicionando favorito' },
    favorite_remove:  { icon: '🗑️', label: 'Removendo favorito' },
    favorite_list:    { icon: '📋', label: 'Listando favoritos' },
  };

  function toolMeta(name: string) {
    return TOOL_META[name] ?? { icon: '⚙️', label: name.replace(/_/g, ' ') };
  }
</script>

<div
  class="message"
  class:message--user={isUser}
  class:message--assistant={!isUser}
  class:message--error={hasError}
  role="article"
  aria-label={isUser ? 'Sua mensagem' : 'Resposta do Genie'}
>
  {#if !isUser}
    <div class="message__avatar" aria-hidden="true">
      <OrbMini state={orbState} />
    </div>
  {/if}

  <div class="message__body">
    <!-- Tool activity: only show while actively running a tool -->
    {#if showToolActivity}
      <div class="message__tool-activity">
        {#each runningTools as call (call.id)}
          {@const meta = toolMeta(call.name)}
          <span class="message__tool-pill">
            <span class="message__tool-icon">{meta.icon}</span>
            <span class="message__tool-label">{meta.label}</span>
            <span class="message__tool-dots">
              <span></span><span></span><span></span>
            </span>
          </span>
        {/each}
      </div>
    {/if}

    <!-- Thinking pill: streaming but no tool + no content yet -->
    {#if isStreaming && !showToolActivity && !message.content}
      <div class="message__tool-activity">
        <span class="message__tool-pill">
          <span class="message__tool-icon">🧠</span>
          <span class="message__tool-label">Analisando sua pergunta</span>
          <span class="message__tool-dots">
            <span></span><span></span><span></span>
          </span>
        </span>
      </div>
    {/if}

    <!-- Main content -->
    {#if message.content}
      <div class="message__bubble">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="message__content">{@html renderedContent}</div>
      </div>
    {/if}

    <!-- Error badge + retry button -->
    {#if hasError}
      <div class="message__error">
        <Badge variant="error" size="sm">Erro ao gerar resposta</Badge>
        <button
          class="message__retry-btn"
          on:click={handleRetry}
          disabled={streaming}
          aria-label="Tentar novamente"
        >
          <RefreshCw size={13} />
          Tentar novamente
        </button>
      </div>
    {/if}
  </div>

  {#if isUser}
    <div class="message__user-avatar" aria-hidden="true">
      <span>U</span>
    </div>
  {/if}
</div>

<style>
  .message {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    max-width: 100%;
    min-width: 0;
    animation: msg-in var(--dur-medium) var(--ease-standard);
  }

  @keyframes msg-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── User: right-aligned ─────────────────────────── */
  .message--user {
    flex-direction: row-reverse;
  }

  /* ── Body ────────────────────────────────────────── */
  .message__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    max-width: 80%;
    min-width: 0;
    flex: 1 1 auto;
  }

  /* Mobile: dar mais largura útil já que o avatar + padding reduzem o espaço */
  @media (max-width: 768px) {
    .message__body {
      max-width: calc(100% - 40px);
    }
  }

  /* No lado do usuário a bolha encolhe ao conteúdo (não cresce até 80%)
     — assim o avatar fica próximo da mensagem em vez de flutuar longe. */
  .message--user .message__body {
    align-items: flex-end;
    flex: 0 1 auto;
  }

  /* ── Bubble ──────────────────────────────────────── */
  .message__bubble {
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-lg);
    font-family: var(--font-body);
    font-size: var(--text-caption);
    line-height: 1.6;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
    max-width: 100%;
  }

  .message--user .message__bubble {
    background: var(--glass-lilac);
    border: 1px solid rgba(167, 155, 255, 0.3);
    color: var(--text-primary);
    border-bottom-right-radius: var(--radius-sm);
  }

  .message--assistant .message__bubble {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    color: var(--text-primary);
    border-bottom-left-radius: var(--radius-sm);
  }

  /* ── Content (markdown-rendered HTML) ───────────── */
  .message__content :global(p) {
    margin: 0 0 var(--space-sm);
  }
  .message__content :global(p:last-child) {
    margin-bottom: 0;
  }
  .message__content :global(strong) {
    color: var(--accent-white);
    font-weight: 600;
  }
  .message__content :global(em) {
    color: var(--text-secondary);
    font-style: italic;
  }
  .message__content :global(code) {
    font-family: var(--font-technical);
    font-size: 13px;
    background: var(--bg-surface-2);
    padding: 2px 6px;
    border-radius: 6px;
    color: var(--accent-gold);
  }
  .message__content :global(a) {
    color: var(--accent-lilac);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .message__content :global(a:hover) {
    color: var(--accent-white);
  }
  .message__content :global(hr) {
    border: none;
    border-top: 1px solid var(--border-soft);
    margin: var(--space-md) 0;
    opacity: 0.6;
  }

  /* ── Typing indicator ────────────────────────────── */
  .message__typing-indicator {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .message__typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--accent-lilac);
    border-radius: 50%;
    animation: typing-dot 1.2s ease-in-out infinite;
  }
  .message__typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .message__typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-dot {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
    40%           { transform: scale(1.1); opacity: 1; }
  }

  /* ── Tool activity pill (only while running) ────────── */
  .message__tool-activity {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-bottom: var(--space-xs);
  }

  .message__tool-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px 5px 10px;
    background: rgba(167, 155, 255, 0.07);
    border: 1px solid rgba(167, 155, 255, 0.25);
    border-radius: var(--radius-full);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-secondary);
    animation: pill-fade 0.25s var(--ease-standard);
  }

  .message__tool-icon {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .message__tool-label {
    color: var(--accent-lilac);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  /* Three bouncing dots after the label */
  .message__tool-dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    margin-left: 2px;
  }

  .message__tool-dots span {
    width: 4px;
    height: 4px;
    background: var(--accent-lilac);
    border-radius: 50%;
    opacity: 0.5;
    animation: tool-dot 1.1s ease-in-out infinite;
  }
  .message__tool-dots span:nth-child(2) { animation-delay: 0.18s; }
  .message__tool-dots span:nth-child(3) { animation-delay: 0.36s; }

  @keyframes pill-fade {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes tool-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40%           { transform: translateY(-3px); opacity: 1; }
  }

  /* ── Markdown: tables ───────────────────────────────── */
  .message__content :global(.md-table-wrap) {
    overflow-x: auto;
    margin: var(--space-sm) 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-soft);
  }

  .message__content :global(.md-table) {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-technical);
    font-size: 13px;
  }

  .message__content :global(.md-table thead tr) {
    background: var(--bg-surface-2);
  }

  .message__content :global(.md-table th) {
    padding: 8px 14px;
    text-align: left;
    color: var(--accent-gold);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-strong);
    white-space: nowrap;
  }

  .message__content :global(.md-table td) {
    padding: 8px 14px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-soft);
  }

  .message__content :global(.md-table tbody tr:last-child td) {
    border-bottom: none;
  }

  .message__content :global(.md-table tbody tr:hover td) {
    background: var(--glass-white);
    color: var(--text-primary);
  }

  /* ── Markdown: headings ─────────────────────────────── */
  .message__content :global(.md-h1),
  .message__content :global(.md-h2),
  .message__content :global(.md-h3) {
    color: var(--text-primary);
    font-family: var(--font-display);
    margin: var(--space-md) 0 var(--space-xs);
    line-height: 1.3;
  }
  .message__content :global(.md-h1) { font-size: 18px; font-weight: 700; }
  .message__content :global(.md-h2) { font-size: 15px; font-weight: 600; color: var(--accent-white); }
  .message__content :global(.md-h3) { font-size: 13px; font-weight: 600; color: var(--accent-gold); }

  /* ── Markdown: lists ────────────────────────────────── */
  .message__content :global(ul),
  .message__content :global(ol) {
    margin: var(--space-xs) 0;
    padding-left: var(--space-xl);
    color: var(--text-secondary);
  }
  .message__content :global(li) {
    margin: 2px 0;
    line-height: 1.6;
  }
  .message__content :global(li strong) {
    color: var(--text-primary);
  }

  /* ── Markdown: code blocks ──────────────────────────── */
  .message__content :global(.md-codeblock) {
    background: var(--bg-primary);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
    margin: var(--space-sm) 0;
    overflow-x: auto;
    font-family: var(--font-technical);
    font-size: 12px;
    color: var(--accent-gold);
    white-space: pre-wrap;
  }

  /* ── Error ───────────────────────────────────────── */
  .message__error {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
    flex-wrap: wrap;
  }

  .message__retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: rgba(167, 155, 255, 0.08);
    border: 1px solid rgba(167, 155, 255, 0.3);
    border-radius: var(--radius-full);
    color: var(--accent-lilac);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard);
  }

  .message__retry-btn:hover:not(:disabled) {
    background: rgba(167, 155, 255, 0.18);
    border-color: var(--accent-lilac);
    color: var(--text-primary);
  }

  .message__retry-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Avatars ─────────────────────────────────────── */
  .message__avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message__user-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--glass-lilac);
    border: 1px solid var(--border-interactive);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    font-weight: 600;
    color: var(--accent-lilac);
  }

  @media (prefers-reduced-motion: reduce) {
    .message { animation: none; }
    .message__typing-indicator span { animation: none; }
  }
</style>
