<script lang="ts">
  export let width = '100%';
  export let height = '16px';
  export let rounded: 'sm' | 'md' | 'lg' | 'full' = 'sm';

  const radiusMap: Record<typeof rounded, string> = {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    full: 'var(--radius-full)',
  };
</script>

<div
  class="skeleton"
  style="width: {width}; height: {height}; border-radius: {radiusMap[rounded]};"
  aria-hidden="true"
  role="presentation"
></div>

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--bg-surface) 0%,
      rgba(167, 155, 255, 0.18) 40%,
      var(--bg-surface) 80%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer var(--dur-cinematic) ease-in-out infinite;
    display: block;
  }

  @keyframes skeleton-shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
</style>
