<script lang="ts">
  export let title: string;
  export let body: string;
  export let editionLabel = ''; // ex: "Edição 3 · Meio-dia"
</script>

<section class="editorial-lead" aria-label="Manchete do editorial">
  <h2 class="editorial-lead__title">{title}</h2>
  <p class="editorial-lead__body editorial-lead__body--dropcap">{body}</p>
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
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .editorial-lead__body {
    margin: 0;
    font-family: var(--font-body, sans-serif);
    font-size: 17px;
    line-height: 1.7;
    color: var(--text-secondary, #b8bac4);
    max-width: 760px;
    letter-spacing: -0.005em;
  }

  .editorial-lead__body--dropcap::first-letter {
    float: left;
    font-size: 4.2em;
    line-height: 0.78;
    margin: 0.06em 0.1em 0 0;
    font-weight: 700;
    color: var(--accent-lilac, #a79bff);
    font-family: var(--font-display, serif);
    letter-spacing: -0.02em;
  }

  @media (max-width: 768px) {
    .editorial-lead { padding: 24px 18px; }
    .editorial-lead::after { left: 18px; }
    .editorial-lead__title { font-size: 22px; }
    .editorial-lead__body { font-size: 15px; }
  }
</style>
