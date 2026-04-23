<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import { chatPanelOpen, sidebarCollapsed } from '$lib/stores/ui';
</script>

<div class="layout">
  <Sidebar collapsed={$sidebarCollapsed} />

  <div class="layout__main">
    <slot />
  </div>

  {#if $chatPanelOpen}
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
  }

  .layout__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .layout__chat {
    width: 380px;
    min-height: 100vh;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-soft);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  /* When chat panel is open, add third column */
  .layout:has(.layout__chat) {
    grid-template-columns: auto 1fr 380px;
  }
</style>
