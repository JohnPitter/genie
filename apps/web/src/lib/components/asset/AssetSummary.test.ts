import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AssetSummary from './AssetSummary.svelte';
import type { Quote, Article } from '@genie/shared';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    ticker: 'PETR4',
    name: 'Petróleo Brasileiro SA',
    price: 38.12,
    changePct: 1.23,
    volume: 12_300_000,
    currency: 'BRL',
    updatedAt: '2026-01-17T12:00:00Z',
    source: 'brapi',
    ...overrides,
  };
}

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    title: 'Petrobras notícia',
    url: 'https://example.com/news/1',
    source: 'InfoMoney',
    tickers: ['PETR4'],
    fetchedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AssetSummary', () => {
  it('renders quote source', () => {
    const { getByText } = render(AssetSummary, { props: { quote: makeQuote(), news: [] } });
    expect(getByText(/brapi/i)).toBeTruthy();
  });

  it('renders Status Invest link', () => {
    const { getByText } = render(AssetSummary, { props: { quote: makeQuote(), news: [] } });
    const link = getByText(/status invest/i);
    expect(link).toBeTruthy();
  });

  it('renders up to 3 latest news articles', () => {
    const news = [
      makeArticle({ title: 'News 1' }),
      makeArticle({ title: 'News 2' }),
      makeArticle({ title: 'News 3' }),
      makeArticle({ title: 'News 4' }), // should not render
    ];
    const { getByText, queryByText } = render(AssetSummary, { props: { quote: makeQuote(), news } });
    expect(getByText('News 1')).toBeTruthy();
    expect(getByText('News 2')).toBeTruthy();
    expect(getByText('News 3')).toBeTruthy();
    expect(queryByText('News 4')).toBeNull();
  });

  it('shows empty state when no news', () => {
    const { getByText } = render(AssetSummary, { props: { quote: makeQuote(), news: [] } });
    expect(getByText(/nenhuma notícia/i)).toBeTruthy();
  });

  it('dispatches viewNews event when "Ver todas" is clicked', async () => {
    const news = [makeArticle({ title: 'Test News' })];
    const { getByText, component } = render(AssetSummary, { props: { quote: makeQuote(), news } });
    const handler = vi.fn();
    component.$on('viewNews', handler);

    await fireEvent.click(getByText(/ver todas/i));

    expect(handler).toHaveBeenCalledOnce();
  });
});
