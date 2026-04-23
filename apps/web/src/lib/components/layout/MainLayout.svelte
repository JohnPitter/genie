<script lang="ts">
  import { Menu, X } from 'lucide-svelte';
  import { page } from '$app/stores';
  import Sidebar from './Sidebar.svelte';
  import { chatPanelOpen, sidebarCollapsed, sidebarOpen } from '$lib/stores/ui';

  function closeDrawer() {
    sidebarOpen.set(false);
  }

  function closeChat() {
    chatPanelOpen.set(false);
  }

  // Fecha o drawer ao trocar de rota (mobile)
  $: if ($page.url.pathname) {
    sidebarOpen.set(false);
  }
</script>

<!-- Hamburger fixo (só visível em mobile) -->
<button
  type="button"
  class="layout__menu-btn"
  aria-label={$sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
  aria-expanded={$sidebarOpen}
  on:click={() => sidebarOpen.update((v) => !v)}
>
  {#if $sidebarOpen}
    <X size={20} />
  {:else}
    <Menu size={20} />
  {/if}
</button>

<div class="layout" class:layout--sidebar-open={$sidebarOpen}>
  <Sidebar collapsed={$sidebarCollapsed} />

  <!-- Backdrop mobile (sidebar drawer) -->
  {#if $sidebarOpen}
    <button
      type="button"
      class="layout__backdrop"
      aria-label="Fechar menu"
      on:click={closeDrawer}
    ></button>
  {/if}

  <div class="layout__main">
    <slot />
  </div>

  {#if $chatPanelOpen}
    <!-- Backdrop mobile (chat overlay) -->
    <button
      type="button"
      class="layout__backdrop layout__backdrop--chat"
      aria-label="Fechar chat"
      on:click={closeChat}
    ></button>
    <aside class="layout__chat" aria-label="Painel de chat">
      <slot name="chat" />
    </aside>
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: auto 1fr;
    min-height: 100dvh;
    background: var(--gradient-bg);
    background-attachment: fixed;
    align-items: start;
  }

  /* Sticky sidebar so backdrop-filter renders against scrolling content */
  .layout > :global(aside.sidebar) {
    position: sticky;
    top: 0;
    height: 100dvh;
  }

  .layout__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: visible;
  }

  .layout__chat {
    width: 380px;
    min-height: 100dvh;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-soft);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  /* When chat panel is open, add third column (desktop only) */
  .layout:has(.layout__chat) {
    grid-template-columns: auto 1fr 380px;
  }

  /* ── Hamburger button (mobile only) ─────────────────────────── */
  .layout__menu-btn {
    display: none;
    position: fixed;
    top: calc(env(safe-area-inset-top, 0) + 12px);
    left: calc(env(safe-area-inset-left, 0) + 12px);
    z-index: 60;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    background: rgba(22, 23, 28, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard);
  }

  .layout__menu-btn:hover {
    background: rgba(32, 33, 40, 0.95);
  }

  .layout__menu-btn:focus-visible {
    outline: 2px solid var(--accent-lilac);
    outline-offset: 2px;
  }

  /* ── Backdrop (mobile drawer + chat) ─────────────────────────── */
  .layout__backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(5, 5, 7, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 0;
    padding: 0;
    cursor: pointer;
    animation: backdrop-in var(--dur-fast) var(--ease-standard);
  }

  .layout__backdrop--chat { z-index: 45; }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Mobile (≤768px) ─────────────────────────────────────────── */
  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .layout:has(.layout__chat) {
      grid-template-columns: 1fr;
    }

    /* Sidebar vira drawer: fixa, fora da tela por padrão */
    .layout > :global(aside.sidebar) {
      position: fixed;
      top: 0;
      left: 0;
      height: 100dvh;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform var(--dur-medium) var(--ease-standard);
      box-shadow: 2px 0 24px rgba(0, 0, 0, 0.4);
      padding-top: calc(env(safe-area-inset-top, 0) + var(--space-xl));
      padding-bottom: calc(env(safe-area-inset-bottom, 0) + var(--space-lg));
    }

    .layout--sidebar-open > :global(aside.sidebar) {
      transform: translateX(0);
    }

    /* Content full-width */
    .layout__main {
      grid-column: 1;
      padding-top: calc(env(safe-area-inset-top, 0) + 56px);
      min-height: 100dvh;
    }

    /* Chat panel vira overlay fullscreen */
    .layout__chat {
      position: fixed;
      inset: 0;
      z-index: 50;
      width: 100%;
      min-height: 100dvh;
      border-left: none;
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .layout__menu-btn {
      display: flex;
    }

    .layout__backdrop {
      display: block;
    }
  }
</style>
