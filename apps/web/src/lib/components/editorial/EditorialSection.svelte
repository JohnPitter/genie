<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import QuoteBadge from './QuoteBadge.svelte';
  import type { EditorialSection, Article, Category, Quote } from '@genie/shared';

  export let section: EditorialSection;
  export let articlesById: Map<number, Article> = new Map();
  export let quotes: Record<string, Quote> = {};

  const CATEGORY_LABEL: Record<Category, string> = {
    financeiro: 'Financeiro',
    commodities: 'Commodities',
    varejo: 'Varejo',
    energia: 'Energia',
    saneamento: 'Saneamento',
    tecnologia: 'Tecnologia',
    saude: 'Saúde',
  };

  const CATEGORY_EMOJI: Record<Category, string> = {
    financeiro: '🏦',
    commodities: '🌾',
    varejo: '🛒',
    energia: '⛽',
    saneamento: '💧',
    tecnologia: '💻',
    saude: '⚕️',
  };

  $: sourceArticles = section.sourceArticleIds
    .map(id => articlesById.get(id))
    .filter((a): a is Article => a !== undefined);

  $: categoryLabel = CATEGORY_LABEL[section.category] ?? section.category;
  $: categoryEmoji = CATEGORY_EMOJI[section.category] ?? '📰';

  const SENTIMENT_DISPLAY: Record<string, { label: string; icon: string }> = {
    alta:    { label: 'Alta',    icon: '↑' },
    baixa:   { label: 'Baixa',   icon: '↓' },
    lateral: { label: 'Lateral', icon: '→' },
  };

  $: sectionQuotes = section.highlightTickers
    .map(t => quotes[t])
    .filter((q): q is Quote => q !== undefined);

  $: {
    const up   = sectionQuotes.filter(q => q.changePct > 0).length;
    const down = sectionQuotes.filter(q => q.changePct < 0).length;
    sentiment  = sectionQuotes.length === 0 ? null : up > down ? 'alta' : down > up ? 'baixa' : 'lateral';
  }

  let sentiment: string | null = null;
  $: sentimentDisplay = sentiment ? SENTIMENT_DISPLAY[sentiment] ?? null : null;
</script>

<article class="editorial-section" data-category={section.category}>
  <header class="editorial-section__header">
    <div class="editorial-section__header-row">
      <span class="editorial-section__category">
        <span class="editorial-section__emoji" aria-hidden="true">{categoryEmoji}</span>
        <span class="editorial-section__category-label">{categoryLabel}</span>
      </span>
      {#if sentimentDisplay}
        <span
          class="editorial-section__sentiment"
          class:editorial-section__sentiment--up={sentiment === 'alta'}
          class:editorial-section__sentiment--down={sentiment === 'baixa'}
          class:editorial-section__sentiment--flat={sentiment === 'lateral'}
        >{sentimentDisplay.icon} {sentimentDisplay.label}</span>
      {/if}
    </div>
    <h3 class="editorial-section__title">{section.title}</h3>
  </header>

  <p class="editorial-section__body">{section.body}</p>

  {#if section.highlightTickers.length > 0}
    <div class="editorial-section__tickers" aria-label="Tickers em destaque">
      {#each section.highlightTickers as ticker (ticker)}
        <QuoteBadge {ticker} quote={quotes[ticker]} />
      {/each}
    </div>
  {/if}

  {#if sourceArticles.length > 0}
    <footer class="editorial-section__sources">
      <span class="editorial-section__sources-label">Fontes citadas</span>
      <ul class="editorial-section__sources-list">
        {#each sourceArticles as article (article.id)}
          <li>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              class="editorial-section__source-link"
            >
              <span class="editorial-section__source-title">{article.title}</span>
              <span class="editorial-section__source-meta">
                <span>{article.source}</span>
                <ExternalLink size={11} />
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </footer>
  {/if}
</article>

<style>
  .editorial-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 24px;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    background: linear-gradient(160deg, #18191f 0%, #101115 100%);
    position: relative;
    overflow: hidden;
    transition:
      transform var(--dur-medium, 220ms) var(--ease-standard, cubic-bezier(0.2, 0.8, 0.25, 1)),
      border-color var(--dur-medium, 220ms) var(--ease-standard, cubic-bezier(0.2, 0.8, 0.25, 1));
  }

  .editorial-section:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .editorial-section::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: rgba(167, 155, 255, 0.5);
  }

  .editorial-section[data-category="financeiro"]::after  { background: rgba(167, 155, 255, 0.7); }
  .editorial-section[data-category="tecnologia"]::after  { background: rgba(140, 184, 255, 0.7); }
  .editorial-section[data-category="energia"]::after     { background: rgba(232, 197, 106, 0.7); }
  .editorial-section[data-category="commodities"]::after { background: rgba(207, 194, 154, 0.7); }
  .editorial-section[data-category="varejo"]::after      { background: rgba(126, 214, 167, 0.6); }
  .editorial-section[data-category="saneamento"]::after  { background: rgba(126, 214, 167, 0.5); }
  .editorial-section[data-category="saude"]::after       { background: rgba(240, 124, 124, 0.6); }

  .editorial-section__header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .editorial-section__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .editorial-section__category {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-technical, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-section__sentiment {
    font-family: var(--font-technical, monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 7px;
    border-radius: var(--radius-full, 999px);
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .editorial-section__sentiment--up {
    color: rgb(126, 214, 167);
    background: rgba(126, 214, 167, 0.1);
    border-color: rgba(126, 214, 167, 0.25);
  }

  .editorial-section__sentiment--down {
    color: rgb(240, 124, 124);
    background: rgba(240, 124, 124, 0.1);
    border-color: rgba(240, 124, 124, 0.25);
  }

  .editorial-section__sentiment--flat {
    color: var(--text-muted, #6c6f7a);
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .editorial-section__emoji {
    font-size: 13px;
  }

  .editorial-section__title {
    margin: 0;
    font-family: var(--font-display, serif);
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.25;
    color: var(--text-primary, #fafafa);
  }

  .editorial-section__body {
    margin: 0;
    font-family: var(--font-body, sans-serif);
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--text-secondary, #b8bac4);
  }

  .editorial-section__tickers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .editorial-section__sources {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 14px;
    margin-top: auto;
    border-top: 1px solid var(--border-soft);
  }

  .editorial-section__sources-label {
    font-family: var(--font-technical, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted, #6c6f7a);
  }

  .editorial-section__sources-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .editorial-section__source-link {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    margin: -8px -10px;
    border-radius: var(--radius-sm, 6px);
    text-decoration: none;
    color: var(--text-secondary, #b8bac4);
    font-size: 12.5px;
    line-height: 1.4;
    transition: background var(--dur-fast, 120ms) ease, color var(--dur-fast, 120ms) ease;
  }

  .editorial-section__source-link:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary, #fafafa);
  }

  .editorial-section__source-title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .editorial-section__source-meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-technical, monospace);
    font-size: 10.5px;
    color: var(--text-muted, #6c6f7a);
  }
</style>
