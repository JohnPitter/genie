<script lang="ts">
  export let title: string;
  export let body: string;
</script>

<section class="editorial-lead" aria-label="Manchete do editorial">
  <h2 class="editorial-lead__title">{title}</h2>
  <p class="editorial-lead__body">{body}</p>
</section>

<style>
  .editorial-lead {
    padding: 36px 40px;
    border: 1px solid rgba(167, 155, 255, 0.18);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(ellipse at top right, rgba(167, 155, 255, 0.10) 0%, transparent 55%),
      linear-gradient(160deg, #1a1b22 0%, #101117 100%);
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }

  .editorial-lead::after {
    content: '';
    position: absolute;
    left: 32px;
    top: 24px;
    width: 36px;
    height: 3px;
    border-radius: 2px;
    background: var(--accent-lilac, #a79bff);
  }

  .editorial-lead__title {
    margin: 18px 0 18px;
    font-family: var(--font-display, serif);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.15;
    color: var(--text-primary, #fafafa);
    max-width: 920px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .editorial-lead__body {
    margin: 0;
    font-family: var(--font-body, sans-serif);
    font-size: 17px;
    line-height: 1.6;
    color: var(--text-secondary, #b8bac4);
    max-width: 760px;
    letter-spacing: -0.005em;
  }

  @media (max-width: 768px) {
    .editorial-lead { padding: 24px 18px; }
    .editorial-lead::after { left: 18px; }
    .editorial-lead__title { font-size: 22px; }
    .editorial-lead__body { font-size: 15px; }
  }
</style>
