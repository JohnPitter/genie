<script lang="ts">
  import '../lib/theme/orb-quantum.css';
  import MainLayout from '$lib/components/layout/MainLayout.svelte';
  import { page, navigating } from '$app/stores';
</script>

{#if $navigating}
  <div class="nav-progress" aria-hidden="true">
    <div class="nav-progress__bar"></div>
  </div>
{/if}

<MainLayout>
  {#key $page.url.pathname}
    <div class="route-fade">
      <slot />
    </div>
  {/key}
</MainLayout>

<style>
  /* ── Barra de progresso de navegação (aparece durante load() lento) ── */
  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    height: 2px;
    background: transparent;
    pointer-events: none;
  }

  .nav-progress__bar {
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, var(--accent-lilac, #a79bff) 0%, rgba(167, 155, 255, 0.6) 100%);
    animation: nav-progress 1.4s ease-in-out infinite;
    transform-origin: left;
  }

  @keyframes nav-progress {
    0%   { transform: scaleX(0); opacity: 1; }
    60%  { transform: scaleX(0.85); opacity: 1; }
    100% { transform: scaleX(1); opacity: 0; }
  }

  /* Fade + subtle lift entre navegações de rotas */
  .route-fade {
    animation: route-in 260ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
    /* Herda comportamento de flex do layout__main para não quebrar páginas
       que usam min-height 100dvh ou flex-direction column */
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  @keyframes route-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .route-fade { animation: none; }
  }
</style>
