import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import FavoriteRow from './FavoriteRow.svelte';
import type { FavoriteEnriched } from '@genie/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<FavoriteEnriched> = {}): FavoriteEnriched {
  return {
    ticker: 'PETR4',
    addedAt: '2026-01-01T00:00:00Z',
    newsCount: 0,
    ...overrides,
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('FavoriteRow — rendering', () => {
  it('renders ticker acronym in avatar', () => {
    render(FavoriteRow, { props: { item: makeItem({ ticker: 'PETR4' }) } });
    // Last 4 chars of 'PETR4' → 'ETR4'
    expect(screen.getByText('ETR4')).toBeInTheDocument();
  });

  it('renders ticker name in header', () => {
    render(FavoriteRow, { props: { item: makeItem({ ticker: 'VALE3' }) } });
    expect(screen.getByText('VALE3')).toBeInTheDocument();
  });

  it('renders "Sem notícias recentes" when latestNews is absent', () => {
    render(FavoriteRow, { props: { item: makeItem({ latestNews: undefined }) } });
    expect(screen.getByText(/Sem notícias recentes/i)).toBeInTheDocument();
  });

  it('renders news title when latestNews is present', () => {
    const item = makeItem({
      newsCount: 1,
      latestNews: {
        title: 'PETR4 sobe 3%',
        url: 'https://example.com',
        source: 'InfoMoney',
        tickers: ['PETR4'],
        fetchedAt: new Date().toISOString(),
      },
    });
    render(FavoriteRow, { props: { item } });
    expect(screen.getByText('PETR4 sobe 3%')).toBeInTheDocument();
  });

  it('renders price when quote is present', () => {
    const item = makeItem({
      quote: {
        ticker: 'PETR4',
        name: 'Petrobras',
        price: 38.50,
        changePct: 1.2,
        volume: 1000000,
        currency: 'BRL',
        updatedAt: new Date().toISOString(),
        source: 'mock',
      },
    });
    render(FavoriteRow, { props: { item } });
    // Price formatted as BRL — check for "38"
    const priceText = screen.getByText(/38/);
    expect(priceText).toBeInTheDocument();
  });

  it('renders "—" when quote is absent', () => {
    render(FavoriteRow, { props: { item: makeItem({ quote: undefined }) } });
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// ── New news badge ────────────────────────────────────────────────────────────

describe('FavoriteRow — new news badge', () => {
  it('shows badge when lastNewsAt is after lastSeenAt', () => {
    const item = makeItem({
      newsCount: 3,
      lastNewsAt: new Date(Date.now() - 1000).toISOString(), // 1s ago
    });
    const lastSeenAt = new Date(Date.now() - 5000).toISOString(); // 5s ago

    render(FavoriteRow, { props: { item, lastSeenAt } });
    expect(screen.getByText(/3 nova/i)).toBeInTheDocument();
  });

  it('does NOT show badge when lastSeenAt is after lastNewsAt', () => {
    const item = makeItem({
      newsCount: 3,
      lastNewsAt: new Date(Date.now() - 5000).toISOString(), // 5s ago
    });
    const lastSeenAt = new Date(Date.now() - 1000).toISOString(); // 1s ago

    render(FavoriteRow, { props: { item, lastSeenAt } });
    expect(screen.queryByText(/nova/i)).not.toBeInTheDocument();
  });

  it('shows badge when no lastSeenAt and newsCount > 0', () => {
    const item = makeItem({
      newsCount: 2,
      lastNewsAt: new Date().toISOString(),
    });

    render(FavoriteRow, { props: { item, lastSeenAt: undefined } });
    expect(screen.getByText(/2 nova/i)).toBeInTheDocument();
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

describe('FavoriteRow — events', () => {
  it('dispatches remove event when remove button is clicked', async () => {
    const item = makeItem({ ticker: 'ITUB4' });
    const { component } = render(FavoriteRow, { props: { item } });

    const onRemove = vi.fn();
    component.$on('remove', onRemove);

    const removeBtn = screen.getByRole('button', { name: /remover itub4/i });
    await fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove.mock.calls[0][0].detail).toEqual({ ticker: 'ITUB4' });
  });

  it('dispatches navigate event when navigate button is clicked', async () => {
    const item = makeItem({ ticker: 'BBAS3' });
    const { component } = render(FavoriteRow, { props: { item } });

    const onNavigate = vi.fn();
    component.$on('navigate', onNavigate);

    const navBtn = screen.getByRole('button', { name: /ver detalhes de bbas3/i });
    await fireEvent.click(navBtn);

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate.mock.calls[0][0].detail).toEqual({ ticker: 'BBAS3' });
  });
});
