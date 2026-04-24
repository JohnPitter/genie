<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import EditorialHeader from '$lib/components/editorial/EditorialHeader.svelte';
  import EditorialLead from '$lib/components/editorial/EditorialLead.svelte';
  import EditorialSection from '$lib/components/editorial/EditorialSection.svelte';
  import EditorialArchive from '$lib/components/editorial/EditorialArchive.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: editorial = data.editorial;
  $: archive = data.archive;
  $: quotes = data.quotes ?? {};
  $: sourceArticles = editorial.sourceArticles ?? [];
  $: articlesById = new Map(sourceArticles.map(a => [a.id, a]));
</script>

<svelte:head>
  <title>{editorial.leadTitle} · Editorial · Genie</title>
</svelte:head>

<div class="editorial-page">
  <a href="/editorial" class="editorial-page__back">
    <ArrowLeft size={14} />
    <span>Voltar à edição atual</span>
  </a>

  <div class="editorial-page__layout">
    <main class="editorial-page__main">
      <EditorialHeader
        slot={editorial.slot}
        editionDate={editorial.editionDate}
        generatedAt={editorial.generatedAt}
        isLive={false}
      />

      <EditorialLead title={editorial.leadTitle} body={editorial.leadBody} />

      <div class="editorial-page__sections">
        {#each editorial.sections as section, i (section.category + i)}
          <EditorialSection {section} {articlesById} {quotes} />
        {/each}
      </div>
    </main>

    <div class="editorial-page__aside">
      <EditorialArchive editions={archive} currentId={editorial.id} />
    </div>
  </div>
</div>

<style>
  .editorial-page {
    box-sizing: border-box;
    width: 100%;
    max-width: 1320px;
    margin-inline: auto;
    padding: 24px 28px 64px;
    flex: 1;
    min-width: 0;
    align-self: stretch;
  }

  .editorial-page__back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-technical, monospace);
    font-size: 12px;
    color: var(--text-muted, #6c6f7a);
    text-decoration: none;
    margin-bottom: 16px;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 6px);
    transition: color var(--dur-fast, 120ms) ease, background var(--dur-fast, 120ms) ease;
  }

  .editorial-page__back:hover {
    color: var(--text-primary, #fafafa);
    background: rgba(255, 255, 255, 0.04);
  }

  .editorial-page__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 32px;
    align-items: start;
  }

  .editorial-page__main {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  .editorial-page__sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .editorial-page__aside { position: sticky; top: 32px; min-width: 0; }

  @media (max-width: 1100px) {
    .editorial-page__layout { grid-template-columns: 1fr; }
    .editorial-page__aside { position: static; }
  }

  @media (max-width: 768px) {
    .editorial-page { padding: 12px 14px 48px; }
    .editorial-page__layout { gap: 18px; }
    .editorial-page__main { gap: 16px; }
    .editorial-page__sections { grid-template-columns: 1fr; gap: 14px; }
  }
</style>
