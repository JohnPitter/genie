<script lang="ts">
  import { Newspaper } from 'lucide-svelte';
  import EditorialHeader from '$lib/components/editorial/EditorialHeader.svelte';
  import EditorialLead from '$lib/components/editorial/EditorialLead.svelte';
  import EditorialSection from '$lib/components/editorial/EditorialSection.svelte';
  import EditorialArchive from '$lib/components/editorial/EditorialArchive.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: editorial = data.editorial;
  $: archive = data.archive;
  $: loadError = data.loadError;
  $: sourceArticles = editorial?.sourceArticles ?? [];
</script>

<svelte:head>
  <title>Por dentro das notícias · Genie</title>
  <meta name="description" content="Editorial financeiro brasileiro com análise investigativa do mercado, gerado quatro vezes ao dia." />
</svelte:head>

<div class="editorial-page">
  {#if loadError}
    <div class="editorial-page__error" role="alert">
      <h2>Não foi possível carregar o editorial</h2>
      <p>{loadError}</p>
    </div>
  {:else if !editorial}
    <div class="editorial-page__empty">
      <Newspaper size={48} />
      <h2>Nenhuma edição publicada ainda</h2>
      <p>
        O editorial é gerado quatro vezes ao dia (08h, 12h, 16h e 20h, horário de Brasília)
        a partir das notícias coletadas em cada janela. Volte em instantes.
      </p>
    </div>
  {:else}
    <div class="editorial-page__layout">
      <main class="editorial-page__main">
        <EditorialHeader
          slot={editorial.slot}
          editionDate={editorial.editionDate}
          generatedAt={editorial.generatedAt}
          isLive={true}
        />

        <EditorialLead title={editorial.leadTitle} body={editorial.leadBody} />

        <div class="editorial-page__sections">
          {#each editorial.sections as section, i (section.category + i)}
            <EditorialSection {section} articles={sourceArticles} />
          {/each}
        </div>
      </main>

      <div class="editorial-page__aside">
        <EditorialArchive editions={archive} currentId={editorial.id} />
      </div>
    </div>
  {/if}
</div>

<style>
  .editorial-page {
    box-sizing: border-box;
    width: 100%;
    max-width: 1320px;
    margin-inline: auto;
    padding: 32px 28px 64px;
    flex: 1;
    min-width: 0;
    align-self: stretch;
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

  .editorial-page__aside {
    position: sticky;
    top: 32px;
    min-width: 0;
  }

  .editorial-page__empty,
  .editorial-page__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    padding: 80px 24px;
    color: var(--text-secondary, #b8bac4);
  }

  .editorial-page__empty :global(svg) {
    color: var(--text-muted, #6c6f7a);
    margin-bottom: 6px;
  }

  .editorial-page__empty h2,
  .editorial-page__error h2 {
    margin: 0;
    font-family: var(--font-display, serif);
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #fafafa);
  }

  .editorial-page__empty p,
  .editorial-page__error p {
    margin: 0;
    max-width: 460px;
    font-size: 14px;
    line-height: 1.55;
  }

  @media (max-width: 1100px) {
    .editorial-page__layout { grid-template-columns: 1fr; }
    .editorial-page__aside { position: static; }
  }

  @media (max-width: 768px) {
    /* Mobile: o MainLayout reserva 56px no topo para o hamburger fixo,
       mas precisamos dar respiro adicional para o header não colar nele. */
    .editorial-page { padding: 16px 14px 48px; gap: 16px; }
    .editorial-page__layout { gap: 18px; }
    .editorial-page__main { gap: 16px; }
    .editorial-page__sections { grid-template-columns: 1fr; gap: 14px; }
  }
</style>
