import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AssetTabs from './AssetTabs.svelte';

describe('AssetTabs', () => {
  it('renders all 4 tabs', () => {
    const { getByText } = render(AssetTabs, { props: { active: 'summary' } });
    expect(getByText('Resumo')).toBeTruthy();
    expect(getByText('Fundamentos')).toBeTruthy();
    expect(getByText('Notícias')).toBeTruthy();
    expect(getByText('Chat')).toBeTruthy();
  });

  it('marks active tab with aria-selected=true', () => {
    const { getAllByRole } = render(AssetTabs, { props: { active: 'news' } });
    const tabs = getAllByRole('tab');
    const newsTab = tabs.find((t) => t.textContent?.trim() === 'Notícias');
    expect(newsTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('has role=tablist on container', () => {
    const { getByRole } = render(AssetTabs, { props: { active: 'summary' } });
    expect(getByRole('tablist')).toBeTruthy();
  });

  it('dispatches change event when a tab is clicked', async () => {
    const { getByText, component } = render(AssetTabs, { props: { active: 'summary' } });
    const handler = vi.fn();
    component.$on('change', handler);

    await fireEvent.click(getByText('Fundamentos'));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].detail).toBe('fundamentals');
  });

  it('non-active tabs have aria-selected=false', () => {
    const { getAllByRole } = render(AssetTabs, { props: { active: 'summary' } });
    const tabs = getAllByRole('tab');
    const nonActive = tabs.filter((t) => t.textContent?.trim() !== 'Resumo');
    nonActive.forEach((tab) => {
      expect(tab.getAttribute('aria-selected')).toBe('false');
    });
  });
});
