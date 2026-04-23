import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ArticleCard from './ArticleCard.svelte';
import type { Article } from '@genie/shared';

const article: Article = {
  id: 1,
  title: 'Petrobras anuncia novo dividendo',
  url: 'https://infomoney.com.br/petrobras-dividendo',
  source: 'InfoMoney',
  summary: 'A Petrobras anunciou hoje um dividendo extraordinário de R$ 1,50 por ação.',
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  tickers: ['PETR4', 'PETR3'],
  category: 'commodities',
  fetchedAt: new Date().toISOString(),
};

describe('ArticleCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let openSpy: any;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('renders article title', () => {
    const { getByText } = render(ArticleCard, { props: { article } });
    expect(getByText('Petrobras anuncia novo dividendo')).toBeInTheDocument();
  });

  it('renders source', () => {
    const { getByText } = render(ArticleCard, { props: { article } });
    expect(getByText('InfoMoney')).toBeInTheDocument();
  });

  it('renders relative time', () => {
    const { getByText } = render(ArticleCard, { props: { article } });
    expect(getByText('há 2h')).toBeInTheDocument();
  });

  it('renders summary when present', () => {
    const { getByText } = render(ArticleCard, { props: { article } });
    expect(getByText(/Petrobras anunciou/)).toBeInTheDocument();
  });

  it('does not render summary area when summary is absent', () => {
    const noSummary: Article = { ...article, summary: undefined };
    const { container } = render(ArticleCard, { props: { article: noSummary } });
    expect(container.querySelector('.article-card__summary')).toBeNull();
  });

  it('renders tickers as gold badges', () => {
    const { getByText } = render(ArticleCard, { props: { article } });
    expect(getByText('PETR4')).toBeInTheDocument();
    expect(getByText('PETR3')).toBeInTheDocument();
  });

  it('opens URL in new tab on click', async () => {
    const { container } = render(ArticleCard, { props: { article } });
    const card = container.querySelector('.article-card') as HTMLElement;
    await fireEvent.click(card);
    expect(openSpy).toHaveBeenCalledWith(
      'https://infomoney.com.br/petrobras-dividendo',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens URL on Enter key', async () => {
    const { container } = render(ArticleCard, { props: { article } });
    const card = container.querySelector('.article-card') as HTMLElement;
    await fireEvent.keyDown(card, { key: 'Enter' });
    expect(openSpy).toHaveBeenCalled();
  });

  it('opens URL on Space key', async () => {
    const { container } = render(ArticleCard, { props: { article } });
    const card = container.querySelector('.article-card') as HTMLElement;
    await fireEvent.keyDown(card, { key: ' ' });
    expect(openSpy).toHaveBeenCalled();
  });

  it('does not render time when publishedAt is absent', () => {
    const noDate: Article = { ...article, publishedAt: undefined };
    const { container } = render(ArticleCard, { props: { article: noDate } });
    expect(container.querySelector('.article-card__time')).toBeNull();
  });

  it('does not render tickers area when tickers is empty', () => {
    const noTickers: Article = { ...article, tickers: [] };
    const { container } = render(ArticleCard, { props: { article: noTickers } });
    expect(container.querySelector('.article-card__tickers')).toBeNull();
  });

  it('card element is keyboard focusable (tabindex=0)', () => {
    const { container } = render(ArticleCard, { props: { article } });
    const card = container.querySelector('.article-card') as HTMLElement;
    expect(card.getAttribute('tabindex')).toBe('0');
  });
});
