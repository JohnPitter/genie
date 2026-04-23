import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writable } from 'svelte/store';
import AssetHeader from './AssetHeader.svelte';
import type { Quote } from '@genie/shared';

const { mockToggle } = vi.hoisted(() => ({
  mockToggle: vi.fn().mockResolvedValue(true),
}));

vi.mock('$lib/stores/favorites', () => {
  const store = writable({
    tickers: new Set<string>(),
    items: [],
    loading: false,
    error: null,
    lastLoadedAt: null,
  });
  return {
    favoritesStore: store,
    favoritesActions: {
      load: vi.fn().mockResolvedValue(undefined),
      toggle: mockToggle,
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockReturnValue(false),
    },
  };
});

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

describe('AssetHeader', () => {
  beforeEach(() => {
    mockToggle.mockClear();
  });

  it('renders the ticker symbol', () => {
    const { getByText } = render(AssetHeader, { props: { quote: makeQuote(), ticker: 'PETR4' } });
    expect(getByText('PETR4')).toBeTruthy();
  });

  it('renders the company name', () => {
    const { getByText } = render(AssetHeader, { props: { quote: makeQuote(), ticker: 'PETR4' } });
    expect(getByText('Petróleo Brasileiro SA')).toBeTruthy();
  });

  it('renders price with BRL currency prefix', () => {
    const { container } = render(AssetHeader, { props: { quote: makeQuote({ price: 38.12 }), ticker: 'PETR4' } });
    const priceEl = container.querySelector('.asset-price__value');
    expect(priceEl?.textContent).toContain('R$');
    expect(priceEl?.textContent).toContain('38');
  });

  it('renders positive change percent with + sign', () => {
    const { container } = render(AssetHeader, { props: { quote: makeQuote({ changePct: 1.23 }), ticker: 'PETR4' } });
    const changeEl = container.querySelector('.asset-price__change');
    expect(changeEl?.textContent?.trim()).toBe('+1.23%');
  });

  it('renders negative change percent', () => {
    const { container } = render(AssetHeader, { props: { quote: makeQuote({ changePct: -2.5 }), ticker: 'PETR4' } });
    const changeEl = container.querySelector('.asset-price__change');
    expect(changeEl?.textContent?.trim()).toBe('-2.50%');
  });

  it('renders source in meta section', () => {
    const { getByText } = render(AssetHeader, { props: { quote: makeQuote({ source: 'brapi' }), ticker: 'PETR4' } });
    expect(getByText('brapi')).toBeTruthy();
  });

  it('renders volume when provided', () => {
    const { container } = render(AssetHeader, {
      props: { quote: makeQuote({ volume: 12_300_000 }), ticker: 'PETR4' },
    });
    const volumeEl = container.querySelector('.asset-meta__value');
    expect(volumeEl?.textContent).toContain('12.3M');
  });

  it('shows Favoritar button when not favorited', () => {
    const { getByRole } = render(AssetHeader, { props: { quote: makeQuote(), ticker: 'PETR4' } });
    const btn = getByRole('button', { name: /favoritar petr4/i });
    expect(btn).toBeTruthy();
  });

  it('calls toggle when favorite button is clicked', async () => {
    const { getByRole } = render(AssetHeader, { props: { quote: makeQuote(), ticker: 'PETR4' } });
    const btn = getByRole('button', { name: /favoritar/i });
    await fireEvent.click(btn);
    expect(mockToggle).toHaveBeenCalledWith('PETR4');
  });
});
