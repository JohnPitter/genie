import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CategoryTabs from './CategoryTabs.svelte';
import { ALL_CATEGORIES } from '@genie/shared';
import type { Category } from '@genie/shared';

describe('CategoryTabs', () => {
  it('renders all categories', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });
    const pills = container.querySelectorAll('.category-tabs__pill');
    expect(pills.length).toBe(ALL_CATEGORIES.length);
  });

  it('marks active category with --active class', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'commodities' },
    });
    const activePill = container.querySelector('.category-tabs__pill--active');
    expect(activePill).toBeInTheDocument();
    expect(activePill?.textContent?.trim()).toBe('Commodities');
  });

  it('renders Portuguese labels', () => {
    const { getByText } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });
    expect(getByText('Financeiro')).toBeInTheDocument();
    expect(getByText('Commodities')).toBeInTheDocument();
    expect(getByText('Varejo')).toBeInTheDocument();
    expect(getByText('Energia')).toBeInTheDocument();
    expect(getByText('Saneamento')).toBeInTheDocument();
    expect(getByText('Tecnologia')).toBeInTheDocument();
    expect(getByText('Saúde')).toBeInTheDocument();
  });

  it('dispatches change event on click', async () => {
    const handler = vi.fn();
    const { container, component } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });
    component.$on('change', handler);

    const pills = container.querySelectorAll('.category-tabs__pill');
    // Click the second pill (commodities)
    await fireEvent.click(pills[1]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toBe('commodities');
  });

  it('active pill has aria-selected=true', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'varejo' },
    });
    const activePill = container.querySelector('[aria-selected="true"]');
    expect(activePill).toBeInTheDocument();
    expect(activePill?.textContent?.trim()).toBe('Varejo');
  });

  it('inactive pills have aria-selected=false', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });
    const inactivePills = container.querySelectorAll('[aria-selected="false"]');
    expect(inactivePills.length).toBe(ALL_CATEGORIES.length - 1);
  });

  it('clicking a pill updates active', async () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });

    const pills = container.querySelectorAll('.category-tabs__pill');
    await fireEvent.click(pills[3]); // energia

    const newActive = container.querySelector('.category-tabs__pill--active');
    expect(newActive?.textContent?.trim()).toBe('Energia');
  });

  it('renders nav with accessible label', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: ALL_CATEGORIES, active: 'financeiro' },
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toContain('Categorias');
  });

  it('renders empty when no categories given', () => {
    const { container } = render(CategoryTabs, {
      props: { categories: [] as Category[], active: 'financeiro' },
    });
    const pills = container.querySelectorAll('.category-tabs__pill');
    expect(pills.length).toBe(0);
  });
});
