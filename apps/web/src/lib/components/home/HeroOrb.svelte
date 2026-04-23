<script lang="ts">
  import Orb from '$lib/components/Orb.svelte';
  import type { OrbState } from '$lib/stores/chat';

  export let orbState: OrbState = 'idle';
</script>

<section class="hero-orb" aria-label="Genie — assistente financeiro">
  <div class="hero-orb__orb-wrap">
    <Orb state={orbState} size={360} />
  </div>

  <div class="hero-orb__text">
    <h1 class="hero-orb__title">Genie</h1>
    <p class="hero-orb__subtitle">
      Seu assistente financeiro da B3.<br>
      Pergunte sobre qualquer ação, FII, ETF ou BDR.
    </p>
  </div>
</section>

<style>
  .hero-orb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xl);
    text-align: center;
    padding: var(--space-2xl) 0 0;
    animation: hero-in var(--dur-smooth) var(--ease-standard);
  }

  @keyframes hero-in {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hero-orb__orb-wrap {
    filter: drop-shadow(0 0 40px rgba(167, 155, 255, 0.3));
    /* Clamp: min 200px, preferred viewport-based, max 360px */
    width: clamp(200px, 40vw, 360px);
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-orb__text {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: center;
  }

  .hero-orb__title {
    font-family: var(--font-display);
    font-size: clamp(40px, 6vw, 64px);
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0;
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-orb__subtitle {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
    max-width: 420px;
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-orb {
      animation: none;
    }
  }
</style>
