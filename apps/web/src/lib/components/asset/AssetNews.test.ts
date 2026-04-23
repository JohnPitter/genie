import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import AssetNews from './AssetNews.svelte';
import type { Article } from '@genie/shared';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    title: 'Test Article Title',
    url: 'https://example.com/news/1',
    source: 'InfoMoney',
    tickers: ['PETR4'],
    fetchedAt: '2026-01-01T00:00:00Z',
    publishedAt: '2026-01-01T12:00:00Z',
    ...overrides,
  };
}

describe('AssetNews', () => {
  it('shows empty state when no articles', () => {
    const { getByText } = render(AssetNews, { props: { articles: [] } });
    expect(getByText(/nenhuma notícia/i)).toBeTruthy();
  });

  it('renders article titles', () => {
    const articles = [
      makeArticle({ title: 'Petrobras sobe hoje' }),
      makeArticle({ title: 'Vale anuncia dividendos' }),
    ];
    const { getByText } = render(AssetNews, { props: { articles } });
    expect(getByText('Petrobras sobe hoje')).toBeTruthy();
    expect(getByText('Vale anuncia dividendos')).toBeTruthy();
  });

  it('renders article links with correct href', () => {
    const articles = [makeArticle({ url: 'https://infomoney.com.br/news/1' })];
    const { getByText } = render(AssetNews, { props: { articles } });
    const link = getByText('Test Article Title').closest('a');
    expect(link?.getAttribute('href')).toBe('https://infomoney.com.br/news/1');
  });

  it('opens links in new tab', () => {
    const articles = [makeArticle()];
    const { getByText } = render(AssetNews, { props: { articles } });
    const link = getByText('Test Article Title').closest('a');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('renders source name for each article', () => {
    const articles = [makeArticle({ source: 'InfoMoney' })];
    const { getByText } = render(AssetNews, { props: { articles } });
    expect(getByText('InfoMoney')).toBeTruthy();
  });

  it('sorts articles by publishedAt descending', () => {
    const articles = [
      makeArticle({ title: 'Old news', publishedAt: '2026-01-01T00:00:00Z' }),
      makeArticle({ title: 'New news', publishedAt: '2026-01-10T00:00:00Z' }),
    ];
    const { container } = render(AssetNews, { props: { articles } });
    const links = container.querySelectorAll('.news__title');
    expect(links[0].textContent).toBe('New news');
    expect(links[1].textContent).toBe('Old news');
  });
});
