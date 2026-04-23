<script lang="ts">
  import '../lib/theme/orb-quantum.css';
  import MainLayout from '$lib/components/layout/MainLayout.svelte';
  import { page } from '$app/stores';
</script>

<MainLayout>
  {#key $page.url.pathname}
    <div class="route-fade">
      <slot />
    </div>
  {/key}
</MainLayout>

<style>
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
