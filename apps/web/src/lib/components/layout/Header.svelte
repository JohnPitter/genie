<script lang="ts">
  export let title = '';
</script>

<header class="header">
  <div class="header__title-area">
    {#if title}
      <h1 class="header__title">{title}</h1>
    {/if}
  </div>
  <div class="header__actions">
    <slot name="actions" />
  </div>
</header>

<style>
  .header {
    height: 56px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-xl);
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
  }

  .header__title-area {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .header__title {
    font-family: var(--font-display);
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
</style>
