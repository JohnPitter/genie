import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks so they are available inside vi.mock factory ──────────────────

const { mockToggle, mockTickers } = vi.hoisted(() => {
  return {
    mockToggle: vi.fn().mockResolvedValue(true),
    mockTickers: new Set<string>(),
  };
});

// ── Mock the favorites store ───────────────────────────────────────────────────

vi.mock('$lib/stores/favorites', () => ({
  favoritesStore: {
    // Minimal readable-like mock: subscribe returns a function that immediately
    // calls the callback with the initial value.
    subscribe: (run: (value: { tickers: Set<string> }) => void) => {
      run({ tickers: mockTickers });
      return () => {};
    },
  },
  favoritesActions: {
    toggle: mockToggle,
  },
}));

import FavoriteButton from './FavoriteButton.svelte';

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockTickers.clear();
  mockToggle.mockReset();
  mockToggle.mockResolvedValue(true);
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('FavoriteButton — rendering', () => {
  it('renders a button element', () => {
    render(FavoriteButton, { props: { ticker: 'PETR4' } });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is not pressed (aria-pressed=false) when ticker is not favorited', () => {
    render(FavoriteButton, { props: { ticker: 'VALE3' } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is pressed (aria-pressed=true) when ticker is favorited', () => {
    mockTickers.add('PETR4');
    render(FavoriteButton, { props: { ticker: 'PETR4' } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders with size sm class', () => {
    render(FavoriteButton, { props: { ticker: 'PETR4', size: 'sm' } });
    expect(screen.getByRole('button').className).toContain('fav-btn--sm');
  });

  it('renders with size md class by default', () => {
    render(FavoriteButton, { props: { ticker: 'PETR4' } });
    expect(screen.getByRole('button').className).toContain('fav-btn--md');
  });

  it('has accessible aria-label when not favorited', () => {
    render(FavoriteButton, { props: { ticker: 'ITUB4' } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Adicionar ITUB4 aos favoritos');
  });

  it('has accessible aria-label when favorited', () => {
    mockTickers.add('ITUB4');
    render(FavoriteButton, { props: { ticker: 'ITUB4' } });
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Remover ITUB4 dos favoritos');
  });
});

// ── Interaction ───────────────────────────────────────────────────────────────

describe('FavoriteButton — toggle interaction', () => {
  it('calls favoritesActions.toggle with correct ticker on click', async () => {
    render(FavoriteButton, { props: { ticker: 'PETR4' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(mockToggle).toHaveBeenCalledWith('PETR4');
  });

  it('button is disabled while toggling (loading state)', async () => {
    let resolveToggle!: (v: boolean) => void;
    mockToggle.mockReturnValueOnce(new Promise<boolean>((res) => {
      resolveToggle = res;
    }));

    render(FavoriteButton, { props: { ticker: 'VALE3' } });
    const btn = screen.getByRole('button');

    fireEvent.click(btn);
    // While toggling, button should be disabled.
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });

    resolveToggle(true);
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('does not call toggle again if already toggling', async () => {
    let resolveToggle!: (v: boolean) => void;
    mockToggle.mockReturnValueOnce(
      new Promise<boolean>((res) => { resolveToggle = res; }),
    );

    render(FavoriteButton, { props: { ticker: 'VALE3' } });
    const btn = screen.getByRole('button');

    // Click once (starts loading).
    fireEvent.click(btn);
    // Immediately click again — should be no-op since button is disabled.
    fireEvent.click(btn);

    resolveToggle(false);
    await waitFor(() => expect(btn).not.toBeDisabled());

    // Toggle should only have been called once.
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
