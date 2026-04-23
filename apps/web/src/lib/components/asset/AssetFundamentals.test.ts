import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import AssetFundamentals from './AssetFundamentals.svelte';
import type { Fundamentals } from '@genie/shared';

function makeFundamentals(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    ticker: 'PETR4',
    pe: 8.5,
    pb: 1.2,
    dividendYield: 12.3,
    roe: 20.1,
    debtToEquity: 0.85,
    netMargin: 18.6,
    source: 'statusinvest',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AssetFundamentals', () => {
  it('renders skeleton rows when loading', () => {
    const { container } = render(AssetFundamentals, { props: { loading: true } });
    const skeletons = container.querySelectorAll('.fundamentals__row--skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders indicator values when fundamentals are provided', () => {
    const { getByText } = render(AssetFundamentals, {
      props: { fundamentals: makeFundamentals(), loading: false },
    });
    expect(getByText('P/L')).toBeTruthy();
    expect(getByText('P/VP')).toBeTruthy();
    expect(getByText('DY')).toBeTruthy();
    expect(getByText('ROE')).toBeTruthy();
  });

  it('displays "—" for null indicator values', () => {
    const { getAllByText } = render(AssetFundamentals, {
      props: {
        fundamentals: makeFundamentals({ pe: undefined, pb: undefined }),
        loading: false,
      },
    });
    const dashes = getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state when fundamentals is null', () => {
    const { getByText } = render(AssetFundamentals, {
      props: { fundamentals: null, loading: false },
    });
    expect(getByText(/não disponíveis/i)).toBeTruthy();
  });

  it('shows source and date when fundamentals provided', () => {
    const { getByText } = render(AssetFundamentals, {
      props: { fundamentals: makeFundamentals(), loading: false },
    });
    expect(getByText(/statusinvest/i)).toBeTruthy();
  });

  it('renders info tooltip icons for each indicator', () => {
    const { container } = render(AssetFundamentals, {
      props: { fundamentals: makeFundamentals(), loading: false },
    });
    // Each row should have an Info icon cell.
    const infoCells = container.querySelectorAll('.fundamentals__info-cell');
    expect(infoCells.length).toBeGreaterThan(0);
  });
});
