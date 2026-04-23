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
      default:          return '3200ms';
    }
  }

  function rotateDur(s: typeof state): string {
    switch (s) {
      case 'listening': return '12s';
      case 'thinking':  return '5s';
      case 'speaking':  return '7s';
      case 'error':     return '30s';
      default:          return '22s';
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

  $: orbStyle = [
    `--size:${size}px`,
    `--pulse-dur:${pulseDur(state)}`,
    `--rotate-dur:${rotateDur(state)}`,
  ].join('; ');
</script>

<div
  class="orb"
  style={orbStyle}
  data-state={state}
  role="img"
  aria-label={ariaLabel(state)}
>
  <svg
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    class="orb__svg"
    aria-hidden="true"
  >
    <defs>
      <!-- ── Base sphere lighting (3-point: key + fill + rim) ── -->
      <radialGradient id="sphereBase" cx="35%" cy="30%" r="75%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#F5F3FF"/>
        <stop offset="18%"  stop-color="#D6CFFF"/>
        <stop offset="38%"  stop-color="#A79BFF"/>
        <stop offset="62%"  stop-color="#6C42FF"/>
        <stop offset="82%"  stop-color="#3B1CB8"/>
        <stop offset="100%" stop-color="#0E0625"/>
      </radialGradient>

      <!-- ── Rim light (cool blue-purple from bottom-right) ── -->
      <radialGradient id="rimLight" cx="72%" cy="76%" r="55%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#A79BFF" stop-opacity="0.55"/>
        <stop offset="40%"  stop-color="#6C42FF" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>

      <!-- ── Key specular (primary highlight, upper-left) ── -->
      <radialGradient id="keySpec" cx="28%" cy="22%" r="38%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.95"/>
        <stop offset="35%"  stop-color="#EDEBFF" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#FFFFFF"  stop-opacity="0"/>
      </radialGradient>

      <!-- ── Secondary fill spec (softer, center-left) ── -->
      <radialGradient id="fillSpec" cx="38%" cy="45%" r="30%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#FFFFFF"  stop-opacity="0"/>
      </radialGradient>

      <!-- ── Caustic ring at bottom-right edge ── -->
      <radialGradient id="caustic" cx="68%" cy="72%" r="40%" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="#CFC29A" stop-opacity="0.45"/>
        <stop offset="60%"  stop-color="#A79BFF" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>

      <!-- ── Ambient glow (outer halo) ── -->
      <radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#A79BFF" stop-opacity="0.28"/>
        <stop offset="45%"  stop-color="#6C42FF" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#050507" stop-opacity="0"/>
      </radialGradient>

      <!-- ── Orbit ring gradient (fades top/bottom for perspective) ── -->
      <linearGradient id="ringH" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%"   stop-color="#CFC29A" stop-opacity="0"/>
        <stop offset="15%"  stop-color="#CFC29A" stop-opacity="0.55"/>
        <stop offset="50%"  stop-color="#A79BFF" stop-opacity="0.75"/>
        <stop offset="85%"  stop-color="#CFC29A" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#CFC29A" stop-opacity="0"/>
      </linearGradient>

      <linearGradient id="ringV" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stop-color="#A79BFF" stop-opacity="0"/>
        <stop offset="15%"  stop-color="#A79BFF" stop-opacity="0.35"/>
        <stop offset="50%"  stop-color="#CFC29A" stop-opacity="0.55"/>
        <stop offset="85%"  stop-color="#A79BFF" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#A79BFF" stop-opacity="0"/>
      </linearGradient>

      <!-- ── Glow filter ── -->
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>

      <filter id="softBlur" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="1.5"/>
      </filter>

      <filter id="haloBlur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>

      <!-- Clip sphere -->
      <clipPath id="sphereClip">
        <circle cx="100" cy="100" r="56"/>
      </clipPath>
    </defs>

    <!-- ── 1. Ambient halo (breathes) ── -->
    <circle class="halo" cx="100" cy="100" r="90" fill="url(#halo)" filter="url(#haloBlur)"/>

    <!-- ── 2. Orbital rings (rotate on separate layers) ── -->
    <!-- Ring 1: horizontal ellipse, gold gradient -->
    <g class="ring ring--h">
      <ellipse cx="100" cy="100" rx="86" ry="20"
        fill="none" stroke="url(#ringH)" stroke-width="1.1" opacity="0.8"/>
      <!-- Dashed accent -->
      <ellipse cx="100" cy="100" rx="86" ry="20"
        fill="none" stroke="#CFC29A" stroke-width="0.4"
        stroke-dasharray="4 14" opacity="0.45"/>
    </g>

    <!-- Ring 2: tilted 55deg, lilac gradient -->
    <g class="ring ring--t55" transform="rotate(55 100 100)">
      <ellipse cx="100" cy="100" rx="82" ry="18"
        fill="none" stroke="url(#ringV)" stroke-width="0.8" opacity="0.6"/>
    </g>

    <!-- Ring 3: tilted -35deg, dashed subtle -->
    <g class="ring ring--t-35" transform="rotate(-35 100 100)">
      <ellipse cx="100" cy="100" rx="78" ry="15"
        fill="none" stroke="#A79BFF" stroke-width="0.5"
        stroke-dasharray="2 12" opacity="0.3"/>
    </g>

    <!-- ── 3. Orbiting particles ── -->
    <circle class="particle particle--1" r="2.2" fill="#EDEBFF" filter="url(#glow)"/>
    <circle class="particle particle--2" r="1.6" fill="#CFC29A" filter="url(#glow)"/>
    <circle class="particle particle--3" r="1.2" fill="#A79BFF" filter="url(#glow)"/>

    <!-- ── 4. Core sphere (layered for realism) ── -->
    <!-- Shadow base -->
    <circle cx="100" cy="100" r="56" fill="#08041A"/>

    <!-- Main sphere with 3-point lighting -->
    <circle cx="100" cy="100" r="56" fill="url(#sphereBase)"/>

    <!-- Rim light overlay -->
    <circle cx="100" cy="100" r="56" fill="url(#rimLight)"/>

    <!-- Caustic reflection at bottom edge -->
    <circle cx="100" cy="100" r="56" fill="url(#caustic)"/>

    <!-- Fill specular (soft, broad) -->
    <circle cx="100" cy="100" r="56" fill="url(#fillSpec)"/>

    <!-- Key specular highlight (primary, elliptical) -->
    <ellipse cx="81" cy="78" rx="22" ry="17" fill="url(#keySpec)"
      transform="rotate(-15 81 78)" filter="url(#softBlur)"/>

    <!-- Micro specular glint (sharp) -->
    <ellipse cx="74" cy="72" rx="7" ry="5" fill="#FFFFFF" opacity="0.92"
      transform="rotate(-20 74 72)" filter="url(#softBlur)"/>

    <!-- Tiny hot spot -->
    <circle cx="70" cy="68" r="2.5" fill="#FFFFFF" opacity="0.97"/>

    <!-- Edge darkening (fresnel effect) -->
    <circle cx="100" cy="100" r="56"
      fill="none" stroke="#000000" stroke-width="6" opacity="0.35"
      stroke-linejoin="round"/>

    <!-- Thin bright rim (facing light) -->
    <circle cx="100" cy="100" r="56"
      fill="none"
      stroke="url(#ringH)"
      stroke-width="0.8"
      opacity="0.5"/>
  </svg>
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

  .orb__svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* ── Halo breathe ── */
  .halo {
    animation: halo-breathe var(--pulse-dur) ease-in-out infinite alternate;
    transform-origin: 100px 100px;
  }

  @keyframes halo-breathe {
    from { r: 82; opacity: 0.7; }
    to   { r: 96; opacity: 1;   }
  }

  /* ── Ring rotation (each at its own speed and direction) ── */
  .ring--h {
    animation: rotate var(--rotate-dur) linear infinite;
    transform-origin: 100px 100px;
  }

  .ring--t55 {
    animation: rotate calc(var(--rotate-dur) * 1.4) linear infinite reverse;
    transform-origin: 100px 100px;
  }

  .ring--t-35 {
    animation: rotate calc(var(--rotate-dur) * 0.75) linear infinite;
    transform-origin: 100px 100px;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ── Particles orbit on elliptical paths ── */
  .particle--1 {
    animation: orbit-1 var(--rotate-dur) linear infinite;
    transform-origin: 100px 100px;
  }
  .particle--2 {
    animation: orbit-2 calc(var(--rotate-dur) * 0.65) linear infinite reverse;
    transform-origin: 100px 100px;
  }
  .particle--3 {
    animation: orbit-3 calc(var(--rotate-dur) * 1.35) linear infinite;
    transform-origin: 100px 100px;
  }

  @keyframes orbit-1 {
    0%   { transform: rotate(0deg)   translateX(86px) translateY(-2px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(86px) translateY(-2px) rotate(-360deg); }
  }
  @keyframes orbit-2 {
    0%   { transform: rotate(120deg)  translateX(70px) rotate(-120deg)  scaleX(1) rotate(55deg) translateX(70px) rotate(-175deg); }
    100% { transform: rotate(480deg)  translateX(70px) rotate(-480deg)  scaleX(1) rotate(55deg) translateX(70px) rotate(-535deg); }
  }
  @keyframes orbit-3 {
    0%   { transform: rotate(240deg) translateX(79px) rotate(-240deg); }
    100% { transform: rotate(600deg) translateX(79px) rotate(-600deg); }
  }

  /* ── State: error — shift hue toward red ── */
  [data-state='error'] .orb__svg {
    filter: hue-rotate(-35deg) saturate(1.5);
  }

  /* ── State: thinking — gold tint, faster halo ── */
  [data-state='thinking'] .halo {
    filter: hue-rotate(-15deg);
  }

  /* ── State: speaking — brighter ── */
  [data-state='speaking'] .orb__svg {
    filter: brightness(1.12);
  }

  /* ── Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    .halo,
    .ring--h,
    .ring--t55,
    .ring--t-35,
    .particle--1,
    .particle--2,
    .particle--3 {
      animation: none;
    }
  }
</style>
