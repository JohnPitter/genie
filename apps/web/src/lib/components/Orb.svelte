<script lang="ts">
  export let state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' = 'idle';
  export let size: number = 240;
  export let tokensPerSec: number = 0;

  function pulseDur(s: typeof state): string {
    switch (s) {
      case 'listening': return '500ms';
      case 'thinking':  return '400ms';
      case 'speaking':  return '250ms';
      case 'error':     return '800ms';
      default:          return '900ms';
    }
  }

  function breatheDur(s: typeof state): string {
    switch (s) {
      case 'listening': return '500ms';
      case 'thinking':  return '600ms';
      case 'speaking':  return '300ms';
      case 'error':     return '900ms';
      default:          return '900ms';
    }
  }

  function rotateDur(s: typeof state): string {
    switch (s) {
      case 'listening': return '12s';
      case 'thinking':  return '6s';
      case 'speaking':  return '8s';
      case 'error':     return '30s';
      default:          return '18s';
    }
  }

  function ariaLabel(s: typeof state): string {
    switch (s) {
      case 'listening': return 'Genie está ouvindo...';
      case 'thinking':  return 'Genie está pensando...';
      case 'speaking':  return 'Genie está falando...';
      case 'error':     return 'Genie encontrou um erro.';
      default:          return 'Genie — assistente financeiro';
    }
  }

  // Intensity boost for speaking based on tokensPerSec (0-30 tps range)
  $: speakIntensity = state === 'speaking' ? Math.min(1, tokensPerSec / 30) : 0;
  $: orbStyle = [
    `--size:${size}px`,
    `--pulse-dur:${pulseDur(state)}`,
    `--breathe-dur:${breatheDur(state)}`,
    `--rotate-dur:${rotateDur(state)}`,
    `--speak-intensity:${speakIntensity}`,
  ].join('; ');
</script>

<div
  class="orb"
  style={orbStyle}
  data-state={state}
  role="img"
  aria-label={ariaLabel(state)}
>
  <!-- Layer 1: outer glow -->
  <div class="orb__glow-outer" aria-hidden="true"></div>

  <!-- Layer 2: orbital rings (SVG) -->
  <svg
    class="orb__orbital"
    viewBox="0 0 200 200"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#CFC29A" />
        <stop offset="100%" stop-color="#B7A36D" />
      </linearGradient>
      <linearGradient id="lilacGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#A79BFF" />
        <stop offset="100%" stop-color="#6C42FF" />
      </linearGradient>
    </defs>

    <!-- Outer dashed gold ring -->
    <circle
      cx="100" cy="100" r="92"
      fill="none"
      stroke="url(#goldGrad)"
      stroke-width="0.8"
      stroke-dasharray="6 8"
    />
    <!-- Inner white ring -->
    <circle
      cx="100" cy="100" r="72"
      fill="none"
      stroke="#EDEBFF"
      stroke-width="0.4"
      opacity="0.6"
    />
    <!-- Horizontal ellipse (gold) -->
    <ellipse
      cx="100" cy="100" rx="92" ry="28"
      fill="none"
      stroke="#CFC29A"
      stroke-width="0.5"
      opacity="0.5"
    />
    <!-- Vertical ellipse (lilac) -->
    <ellipse
      cx="100" cy="100" rx="28" ry="92"
      fill="none"
      stroke="#A79BFF"
      stroke-width="0.5"
      opacity="0.5"
    />

    <!-- Orbital particles -->
    <circle class="orb__particle orb__particle--1" r="1.5" fill="#EDEBFF" />
    <circle class="orb__particle orb__particle--2" r="1.2" fill="#CFC29A" />
    <circle class="orb__particle orb__particle--3" r="1.0" fill="#A79BFF" />
  </svg>

  <!-- Layer 3: core sphere -->
  <div class="orb__core" aria-hidden="true"></div>
</div>

<style>
  .orb {
    position: relative;
    width: var(--size);
    height: var(--size);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* ── Layer 1: outer glow ─────────────────────────────────────── */
  .orb__glow-outer {
    position: absolute;
    inset: -20%;
    background: radial-gradient(
      circle,
      rgba(237, 235, 255, 0.18) 0%,
      rgba(167, 155, 255, 0.22) 35%,
      rgba(108, 66, 255, 0.08) 65%,
      transparent 80%
    );
    filter: blur(12px);
    animation: breathe var(--breathe-dur) var(--ease-standard, ease-in-out) infinite alternate;
    border-radius: 50%;
  }

  /* ── Layer 2: orbital rings ───────────────────────────────────── */
  .orb__orbital {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: rotate var(--rotate-dur) linear infinite;
  }

  /* ── Particles ────────────────────────────────────────────────── */
  .orb__particle--1 {
    animation: orbit-1 var(--rotate-dur) linear infinite;
    transform-origin: 100px 100px;
  }
  .orb__particle--2 {
    animation: orbit-2 calc(var(--rotate-dur) * 0.7) linear infinite reverse;
    transform-origin: 100px 100px;
  }
  .orb__particle--3 {
    animation: orbit-3 calc(var(--rotate-dur) * 1.3) linear infinite;
    transform-origin: 100px 100px;
  }

  /* ── Layer 3: core sphere ─────────────────────────────────────── */
  .orb__core {
    position: absolute;
    width: 60%;
    height: 60%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(237, 235, 255, 0.95) 0%,
      rgba(167, 155, 255, 0.65) 35%,
      rgba(108, 66, 255, 0.18) 65%,
      rgba(5, 5, 7, 0) 100%
    );
    box-shadow:
      0 0 60px rgba(167, 155, 255, 0.28),
      0 0 120px rgba(237, 235, 255, 0.12);
    animation: pulse var(--pulse-dur) ease-in-out infinite alternate;
  }

  /* ── State: error → reddish tint ────────────────────────────── */
  [data-state='error'] .orb__core {
    filter: hue-rotate(-40deg) saturate(1.4);
  }
  [data-state='error'] .orb__glow-outer {
    filter: blur(12px) hue-rotate(-30deg) saturate(1.2);
  }

  /* ── State: thinking → gold shimmer on core ─────────────────── */
  [data-state='thinking'] .orb__core {
    box-shadow:
      0 0 60px rgba(167, 155, 255, 0.38),
      0 0 120px rgba(207, 194, 154, 0.18),
      0 0 160px rgba(237, 235, 255, 0.12);
  }

  /* ── State: speaking → extra glow intensity ─────────────────── */
  [data-state='speaking'] .orb__core {
    box-shadow:
      0 0 60px rgba(167, 155, 255, 0.45),
      0 0 120px rgba(237, 235, 255, 0.22);
  }

  /* ── Keyframes ────────────────────────────────────────────────── */
  @keyframes breathe {
    from { transform: scale(1);    opacity: 0.85; }
    to   { transform: scale(1.06); opacity: 1;    }
  }

  @keyframes pulse {
    from { transform: scale(0.96); }
    to   { transform: scale(1.04); }
  }

  @keyframes rotate {
    to { transform: rotate(360deg); }
  }

  @keyframes orbit-1 {
    from { transform: rotate(0deg) translateX(88px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(88px) rotate(-360deg); }
  }

  @keyframes orbit-2 {
    from { transform: rotate(120deg) translateX(68px) rotate(-120deg); }
    to   { transform: rotate(480deg) translateX(68px) rotate(-480deg); }
  }

  @keyframes orbit-3 {
    from { transform: rotate(240deg) translateX(78px) rotate(-240deg); }
    to   { transform: rotate(600deg) translateX(78px) rotate(-600deg); }
  }

  /* ── Reduced motion ───────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .orb__glow-outer,
    .orb__orbital,
    .orb__core,
    .orb__particle--1,
    .orb__particle--2,
    .orb__particle--3 {
      animation-duration: 0s;
      animation-play-state: paused;
    }
  }
</style>
