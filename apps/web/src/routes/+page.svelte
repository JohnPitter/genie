<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import HeroOrb from '$lib/components/home/HeroOrb.svelte';
  import CategoryTabs from '$lib/components/home/CategoryTabs.svelte';
  import NewsGrid from '$lib/components/home/NewsGrid.svelte';
  import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import OrbMini from '$lib/components/OrbMini.svelte';
  import { chatStore, chatActions } from '$lib/stores/chat';
  import { favoritesStore, favoritesActions } from '$lib/stores/favorites';
  import { ALL_CATEGORIES } from '@genie/shared';
  import type { Article, Category } from '@genie/shared';
  import { onMount } from 'svelte';

  onMount(() => { favoritesActions.load(false); });

  let activeCategory: Category = 'financeiro';
  let visibleArticles: Article[] = [];

  $: messages = $chatStore.messages;
  $: hasConversation = messages.length > 0;
  $: orbState = $chatStore.orbState;
  $: streaming = $chatStore.streaming;

  // Resizable chat height (desktop only)
  let chatHeight = 600;
  const MIN_HEIGHT = 320;
  const MAX_HEIGHT = () => window.innerHeight - 120;

  // Detect mobile to disable resize feature + use flexible height
  let innerWidth = 1024;
  $: isMobile = innerWidth <= 768;

  function startResize(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startH = chatHeight;

    function onMove(ev: MouseEvent | TouchEvent) {
      const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const delta = y - startY;
      chatHeight = Math.min(Math.max(startH + delta, MIN_HEIGHT), MAX_HEIGHT());
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  function buildNewsContext(articles: Article[]): string {
    if (articles.length === 0) return '';
    return articles
      .slice(0, 8)
      .map((a) => `- [${a.tickers?.join(', ') ?? ''}] ${a.title}${a.summary ? ': ' + a.summary.slice(0, 120) : ''}`)
      .join('\n');
  }

  async function handleHeroSubmit(e: CustomEvent<{ message: string }>) {
    const newsCtx = buildNewsContext(visibleArticles);
    const favTickers = [...$favoritesStore.tickers];

    const contextData: Record<string, string> = {};
    if (newsCtx) {
      contextData.noticias_em_destaque = `Notícias visíveis no painel (categoria: ${activeCategory}):\n${newsCtx}`;
    }
    if (favTickers.length > 0) {
      contextData.ativos_favoritos = `O usuário monitora os seguintes ativos: ${favTickers.join(', ')}`;
    }

    await chatActions.send(e.detail.message, Object.keys(contextData).length ? contextData : undefined);
  }
</script>

<svelte:head>
  <title>Genie — Assistente Financeiro com IA para B3</title>
  <meta name="description" content="Converse com o Genie para consultar cotações, fundamentos, dividendos e notícias de ações, FIIs e ETFs da B3 em tempo real." />
  <meta property="og:title" content="Genie — Assistente Financeiro com IA para B3" />
  <meta property="og:description" content="Converse com o Genie para consultar cotações, fundamentos, dividendos e notícias de ações, FIIs e ETFs da B3 em tempo real." />
</svelte:head>

<svelte:window bind:innerWidth />

<main class="home">
  <!-- ── Mode A: Hero (empty conversation) ──────────────── -->
  {#if !hasConversation}
    <div class="home__hero" in:fade={{ duration: 280 }} out:fade={{ duration: 180 }}>
      <HeroOrb {orbState} />

      <div class="home__hero-input">
        <ChatInput
          placeholder={isMobile ? 'Ex: PETR4, dividendos...' : 'Ex: PETR4, dividendos, fundamentos, rankings...'}
          loading={streaming}
          on:submit={handleHeroSubmit}
        />
      </div>
    </div>

  <!-- ── Mode B: Conversation ─────────────────────────── -->
  {:else}
    <div class="home__conversation" in:fade={{ duration: 280 }}>
      <div class="home__conversation-inner">
        <div
          class="home__orb-compact"
          in:scale={{ duration: 420, start: 0.4 }}
          aria-hidden="true"
        >
          <OrbMini state={orbState} />
        </div>

        <div
          class="home__chat-wrap"
          class:home__chat-wrap--mobile={isMobile}
          style={isMobile ? '' : `height: ${chatHeight}px`}
        >
          <ChatPanel mode="inline" />
          <!-- Resize handle — desktop only -->
          {#if !isMobile}
            <div
              class="home__resize-handle"
              role="separator"
              aria-label="Redimensionar chat"
              aria-orientation="horizontal"
              tabindex="0"
              on:mousedown={startResize}
              on:touchstart={startResize}
              on:keydown={(e) => {
                if (e.key === 'ArrowDown') chatHeight = Math.min(chatHeight + 20, MAX_HEIGHT());
                if (e.key === 'ArrowUp') chatHeight = Math.max(chatHeight - 20, MIN_HEIGHT);
              }}
            >
              <span class="home__resize-dots" aria-hidden="true"></span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- ── News section (hidden when chat active) ────────── -->
  {#if !hasConversation}
    <section
      class="home__news"
      aria-label="Notícias por categoria"
      in:fade={{ duration: 280, delay: 80 }}
      out:fade={{ duration: 180 }}
    >
      <div class="home__news-header">
        <h2 class="home__news-title">Notícias por categoria</h2>
      </div>

      <CategoryTabs
        categories={ALL_CATEGORIES}
        bind:active={activeCategory}
        on:change={(e) => { activeCategory = e.detail; }}
      />

      <div class="home__news-grid">
        <NewsGrid category={activeCategory} limit={12} bind:articles={visibleArticles} />
      </div>
    </section>
  {/if}
</main>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3xl);
    min-height: calc(100dvh - 56px);
    padding: var(--space-3xl) var(--space-xl) var(--space-5xl);
    width: 100%;
    box-sizing: border-box;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ── Hero mode ────────────────────────────────────────── */
  .home__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2xl);
    width: 100%;
  }

  .home__hero-input {
    width: 100%;
    max-width: 560px;
  }

  /* ── Conversation mode ────────────────────────────────── */
  .home__conversation {
    width: 100%;
  }

  .home__conversation-inner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-lg);
    width: 100%;
  }

  .home__orb-compact {
    flex-shrink: 0;
    padding-top: 10px;
  }

  .home__chat-wrap {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 320px;
  }

  /* ── Resize handle ────────────────────────────────────── */
  .home__resize-handle {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 12px;
    cursor: ns-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    transition: background var(--dur-fast) var(--ease-standard);
    outline: none;
  }

  .home__resize-handle:hover,
  .home__resize-handle:focus-visible {
    background: var(--glass-white);
  }

  .home__resize-dots {
    display: block;
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-soft);
    transition: background var(--dur-fast) var(--ease-standard), width var(--dur-fast) var(--ease-standard);
  }

  .home__resize-handle:hover .home__resize-dots,
  .home__resize-handle:focus-visible .home__resize-dots {
    background: var(--border-strong);
    width: 48px;
  }

  /* ── News section ─────────────────────────────────────── */
  .home__news {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
    padding-top: var(--space-lg);
  }

  .home__news-header {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding-left: var(--space-xs);
  }

  .home__news-header::before {
    content: '';
    display: block;
    width: 3px;
    height: 26px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--accent-lilac) 0%, var(--accent-violet) 100%);
    flex-shrink: 0;
  }

  .home__news-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .home__news-grid {
    width: 100%;
  }

  /* ── Responsive ───────────────────────────────────────── */
  @media (max-width: 768px) {
    .home {
      /* Top padding reserva espaço para o botão hamburger fixo (44px + safe-area) */
      padding: calc(env(safe-area-inset-top, 0) + var(--space-xl)) var(--space-md) var(--space-4xl);
      gap: var(--space-2xl);
      min-height: calc(100dvh - 56px);
    }

    .home__conversation-inner {
      flex-direction: column;
    }

    .home__orb-compact {
      align-self: center;
      padding-top: 0;
    }

    .home__hero-input {
      max-width: 100%;
    }

    /* Mobile: chat ocupa altura disponível em vez de height fixa */
    .home__chat-wrap--mobile {
      height: auto !important;
      flex: 1 1 auto;
      min-height: calc(100dvh - 220px);
      max-height: calc(100dvh - 180px);
      width: 100%;
      min-width: 0;
    }

    .home__conversation,
    .home__conversation-inner {
      width: 100%;
      min-width: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home__orb-compact {
      animation: none;
    }
  }
</style>
