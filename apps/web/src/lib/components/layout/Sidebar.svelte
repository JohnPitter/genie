<script lang="ts">
  import { House, Star, TrendingUp } from 'lucide-svelte';
  import { page } from '$app/stores';

  export let collapsed = false;

  const navItems: { href: string; label: string; icon: typeof House }[] = [
    { href: '/', label: 'Início', icon: House },
    { href: '/favorites', label: 'Favoritos', icon: Star },
    { href: '/rankings', label: 'Rankings', icon: TrendingUp },
  ];

  $: currentPath = $page.url.pathname;
</script>

<aside class="sidebar" class:sidebar--collapsed={collapsed} aria-label="Navegação principal">
  <!-- Logo -->
  <div class="sidebar__logo">
    <div class="logo-orb" aria-hidden="true">
      <div class="logo-orb__glow"></div>
      <div class="logo-orb__core"></div>
    </div>
    {#if !collapsed}
      <span class="logo-text">Genie</span>
    {/if}
  </div>

  <!-- Navigation -->
  <nav class="sidebar__nav">
    {#each navItems as item}
      {@const isActive = currentPath === item.href}
      <a
        href={item.href}
        class="nav-item"
        class:nav-item--active={isActive}
        aria-current={isActive ? 'page' : undefined}
      >
        <span class="nav-item__icon" aria-hidden="true">
          <svelte:component this={item.icon} size={20} />
        </span>
        {#if !collapsed}
          <span class="nav-item__label">{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <!-- Footer -->
  {#if !collapsed}
    <footer class="sidebar__footer">
      <div class="sidebar__status">
        <span class="sidebar__status-dot" aria-hidden="true"></span>
        <span class="version-label">v2.0.0 · online</span>
      </div>
    </footer>
  {/if}
</aside>

<style>
  .sidebar {
    width: 240px;
    min-height: 100dvh;
    background: rgba(22, 23, 28, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-right: 1px solid var(--border-soft);
    display: flex;
    flex-direction: column;
    padding: var(--space-xl) 0;
    transition: width var(--dur-medium) var(--ease-standard);
    overflow: hidden;
    flex-shrink: 0;
  }

  /* Mobile: keep width usable on narrow screens */
  @media (max-width: 768px) {
    .sidebar {
      width: min(280px, 85vw);
    }
    .sidebar--collapsed {
      width: min(280px, 85vw);
    }
  }

  .sidebar--collapsed {
    width: 64px;
  }

  /* ── Logo ───────────────────────────────────────────────────── */
  .sidebar__logo {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 0 var(--space-lg) var(--space-lg);
    border-bottom: 1px solid var(--border-soft);
    margin-bottom: var(--space-md);
  }

  .logo-orb {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
  }

  .logo-orb__glow {
    position: absolute;
    inset: -15%;
    background: radial-gradient(
      circle,
      rgba(237, 235, 255, 0.2) 0%,
      rgba(167, 155, 255, 0.25) 40%,
      rgba(108, 66, 255, 0.1) 70%,
      transparent 85%
    );
    filter: blur(6px);
    animation: orb-breathe var(--dur-cinematic) var(--ease-standard) infinite alternate;
    border-radius: 50%;
  }

  .logo-orb__core {
    width: 62%;
    height: 62%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(237, 235, 255, 0.95) 0%,
      rgba(167, 155, 255, 0.7) 40%,
      rgba(108, 66, 255, 0.2) 70%,
      rgba(5, 5, 7, 0) 100%
    );
    box-shadow: 0 0 16px rgba(167, 155, 255, 0.5);
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;
  }

  /* ── Navigation ─────────────────────────────────────────────── */
  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: 0 var(--space-sm);
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 10px var(--space-md);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    text-decoration: none;
    font-family: var(--font-body);
    font-size: var(--text-caption);
    font-weight: 500;
    transition:
      background var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      box-shadow var(--dur-fast) var(--ease-standard);
    border-left: 2px solid transparent;
    position: relative;
    overflow: hidden;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-primary);
    border-left-color: rgba(255, 255, 255, 0.2);
  }

  .nav-item:focus-visible {
    outline: 2px solid var(--accent-lilac);
    outline-offset: 2px;
  }

  .nav-item--active {
    background: linear-gradient(90deg, rgba(167, 155, 255, 0.28) 0%, rgba(167, 155, 255, 0.06) 100%);
    color: var(--accent-lilac);
    border-left-color: var(--accent-lilac);
    box-shadow: inset 0 0 0 1px rgba(167, 155, 255, 0.15);
  }

  .nav-item__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-item__label {
    white-space: nowrap;
  }

  /* ── Footer ──────────────────────────────────────────────────── */
  .sidebar__footer {
    padding: var(--space-lg) var(--space-xl) 0;
    border-top: 1px solid var(--border-soft);
    margin-top: auto;
  }

  .sidebar__status {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .sidebar__status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--status-success);
    box-shadow: var(--glow-green);
    flex-shrink: 0;
    animation: status-breathe 2.8s ease-in-out infinite alternate;
  }

  .version-label {
    font-family: var(--font-technical);
    font-size: var(--text-micro);
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  @keyframes status-breathe {
    from { opacity: 0.7; box-shadow: 0 0 4px rgba(126, 214, 167, 0.3); }
    to   { opacity: 1;   box-shadow: 0 0 10px rgba(126, 214, 167, 0.6); }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar__status-dot { animation: none; }
  }
</style>
