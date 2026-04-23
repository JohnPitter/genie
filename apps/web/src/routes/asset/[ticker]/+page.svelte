<script lang="ts">
  import type { PageData } from './$types';
  import type { Fundamentals } from '@genie/shared';
  import type { AssetTab } from '$lib/components/asset/AssetTabs.svelte';
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import { favoritesActions } from '$lib/stores/favorites';

  import AssetHeader from '$lib/components/asset/AssetHeader.svelte';
  import AssetTabs from '$lib/components/asset/AssetTabs.svelte';
  import AssetSummary from '$lib/components/asset/AssetSummary.svelte';
  import AssetFundamentals from '$lib/components/asset/AssetFundamentals.svelte';
  import AssetNews from '$lib/components/asset/AssetNews.svelte';
  import AssetChat from '$lib/components/asset/AssetChat.svelte';

  export let data: PageData;

  $: ({ ticker, quote, news } = data);

  let activeTab: AssetTab = 'summary';
  let fundamentals: Fundamentals | null = null;
  let fundamentalsLoading = false;
  let fundamentalsError: string | null = null;

  async function loadFundamentals() {
    if (fundamentals || fundamentalsLoading) return;
    fundamentalsLoading = true;
    fundamentalsError = null;
    try {
      fundamentals = await apiClient.getFundamentals(ticker);
    } catch (err) {
      fundamentalsError = err instanceof Error ? err.message : 'Erro ao carregar fundamentos.';
    } finally {
      fundamentalsLoading = false;
    }
  }

  function handleTabChange(event: CustomEvent<AssetTab>) {
    activeTab = event.detail;
    if (activeTab === 'fundamentals') {
      loadFundamentals();
    }
  }

  function goToNews() {
    activeTab = 'news';
  }

  onMount(() => {
    favoritesActions.load();
  });
</script>

<svelte:head>
  <title>{ticker} — Genie</title>
</svelte:head>

<main class="asset-page">
  <div class="asset-page__header">
    <AssetHeader {quote} {ticker} />
  </div>

  <div class="asset-page__tabs">
    <AssetTabs bind:active={activeTab} on:change={handleTabChange} />
  </div>

  <div class="asset-page__content">
    {#if activeTab === 'summary'}
      <AssetSummary {quote} {news} on:viewNews={goToNews} />
    {:else if activeTab === 'fundamentals'}
      {#if fundamentalsError}
        <div class="asset-page__error" role="alert">
          <p>{fundamentalsError}</p>
          <button on:click={loadFundamentals}>Tentar novamente</button>
        </div>
      {:else}
        <AssetFundamentals {fundamentals} loading={fundamentalsLoading} />
      {/if}
    {:else if activeTab === 'news'}
      <AssetNews articles={news} />
    {:else if activeTab === 'chat'}
      <AssetChat {ticker} price={quote.price} name={quote.name} />
    {/if}
  </div>
</main>

<style>
  .asset-page {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--space-2xl) var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  .asset-page__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .asset-page__content {
    padding: var(--space-xl) 0;
    min-height: 300px;
  }

  .asset-page__error {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    align-items: flex-start;
  }

  .asset-page__error p {
    color: var(--status-error);
    font-size: 14px;
    margin: 0;
  }

  .asset-page__error button {
    background: none;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    padding: var(--space-sm) var(--space-lg);
    font-size: 13px;
    cursor: pointer;
    transition:
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard);
  }

  .asset-page__error button:hover {
    border-color: var(--accent-lilac);
    color: var(--accent-lilac);
  }
</style>
