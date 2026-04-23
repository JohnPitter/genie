import { render, waitFor, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import NewsGrid from './NewsGrid.svelte';
import type { ApiClient } from '$lib/api/client';
import type { Article } from '@genie/shared';

const makeArticle = (i: number): Article => ({
  id: i,
  title: `Artigo ${i}`,
  url: `https://example.com/article-${i}`,
  source: 'InfoMoney',
  publishedAt: new Date().toISOString(),
  tickers: ['PETR4'],
  fetchedAt: new Date().toISOString(),
});

const articles = [makeArticle(1), makeArticle(2), makeArticle(3)];

function makeClient(
  impl: () => Promise<Article[]>,
): ApiClient {
  return {
    getNewsByCategory: vi.fn().mockImplementation(impl),
    getNewsByTicker: vi.fn(),
    health: vi.fn(),
    config: vi.fn(),
  } as unknown as ApiClient;
}

describe('NewsGrid', () => {
  it('shows skeleton loaders while loading', () => {
    // Never resolves during test — stays loading
    const client = makeClient(() => new Promise(() => {}));
    const { container } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    expect(container.querySelector('.news-grid__skeleton-card')).toBeInTheDocument();
  });

  it('renders articles after successful load', async () => {
    const client = makeClient(() => Promise.resolve(articles));
    const { getByText } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    await waitFor(() => {
      expect(getByText('Artigo 1')).toBeInTheDocument();
      expect(getByText('Artigo 2')).toBeInTheDocument();
      expect(getByText('Artigo 3')).toBeInTheDocument();
    });
  });

  it('shows empty state when articles array is empty', async () => {
    const client = makeClient(() => Promise.resolve([]));
    const { container } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    await waitFor(() => {
      expect(container.querySelector('.news-grid__empty')).toBeInTheDocument();
    });
  });

  it('shows error state on failure', async () => {
    const client = makeClient(() => Promise.reject(new Error('Falha na rede')));
    const { container } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    await waitFor(() => {
      expect(container.querySelector('.news-grid__error')).toBeInTheDocument();
      expect(container.querySelector('.news-grid__error-msg')?.textContent).toContain('Falha na rede');
    });
  });

  it('shows "Tentar novamente" button on error', async () => {
    const client = makeClient(() => Promise.reject(new Error('erro')));
    const { getByText } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    await waitFor(() => {
      expect(getByText('Tentar novamente')).toBeInTheDocument();
    });
  });

  it('retries load when "Tentar novamente" is clicked', async () => {
    let calls = 0;
    const client = makeClient(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('primeira falha'));
      return Promise.resolve(articles);
    });

    const { getByText } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });

    await waitFor(() => {
      expect(getByText('Tentar novamente')).toBeInTheDocument();
    });

    await fireEvent.click(getByText('Tentar novamente'));

    await waitFor(() => {
      expect(getByText('Artigo 1')).toBeInTheDocument();
    });
  });

  it('renders grid container', async () => {
    const client = makeClient(() => Promise.resolve(articles));
    const { container } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });
    await waitFor(() => {
      expect(container.querySelector('.news-grid__grid')).toBeInTheDocument();
    });
  });

  it('calls getNewsByCategory with correct args', async () => {
    const client = makeClient(() => Promise.resolve(articles));
    render(NewsGrid, {
      props: { category: 'energia', limit: 6, client },
    });
    await waitFor(() => {
      expect(client.getNewsByCategory).toHaveBeenCalledWith('energia', 6);
    });
  });

  it('uses cache for repeated category', async () => {
    const getNewsByCategory = vi.fn().mockResolvedValue(articles);
    const client = { getNewsByCategory } as unknown as ApiClient;

    const { component } = render(NewsGrid, {
      props: { category: 'financeiro', client },
    });

    await waitFor(() => {
      expect(getNewsByCategory).toHaveBeenCalledTimes(1);
    });

    // Switching to another category and back
    component.$set({ category: 'energia' });
    await waitFor(() => {
      expect(getNewsByCategory).toHaveBeenCalledTimes(2);
    });

    // Back to financeiro — should use cache (no new call)
    component.$set({ category: 'financeiro' });
    await new Promise((r) => setTimeout(r, 50));
    expect(getNewsByCategory).toHaveBeenCalledTimes(2); // still 2
  });
});
