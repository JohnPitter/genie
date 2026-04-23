import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';

// Mock $app/stores before importing Sidebar
vi.mock('$app/stores', () => {
  const { readable } = require('svelte/store');
  return {
    page: readable({ url: { pathname: '/' } }),
    navigating: readable(null),
    updated: readable(false),
  };
});

import Sidebar from './Sidebar.svelte';

describe('Sidebar', () => {
  it('renders without crash', () => {
    const { container } = render(Sidebar);
    expect(container.querySelector('.sidebar')).not.toBeNull();
  });

  it('shows all 3 nav items', () => {
    render(Sidebar);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it('nav item "/" has correct href', () => {
    render(Sidebar);
    const homeLink = screen.getByRole('link', { name: /início/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('nav item "/favorites" has correct href', () => {
    render(Sidebar);
    const favLink = screen.getByRole('link', { name: /favoritos/i });
    expect(favLink).toBeInTheDocument();
    expect(favLink.getAttribute('href')).toBe('/favorites');
  });

  it('nav item "/settings" has correct href', () => {
    render(Sidebar);
    const settingsLink = screen.getByRole('link', { name: /configurações/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink.getAttribute('href')).toBe('/settings');
  });

  it('active "/" item has aria-current="page"', () => {
    render(Sidebar);
    const homeLink = screen.getByRole('link', { name: /início/i });
    expect(homeLink.getAttribute('aria-current')).toBe('page');
  });

  it('non-active items do not have aria-current', () => {
    render(Sidebar);
    const favLink = screen.getByRole('link', { name: /favoritos/i });
    expect(favLink.getAttribute('aria-current')).toBeNull();
  });

  it('shows version label', () => {
    render(Sidebar);
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('adds collapsed class when collapsed prop is true', () => {
    const { container } = render(Sidebar, { props: { collapsed: true } });
    expect(container.querySelector('.sidebar--collapsed')).not.toBeNull();
  });

  it('does not add collapsed class by default', () => {
    const { container } = render(Sidebar);
    expect(container.querySelector('.sidebar--collapsed')).toBeNull();
  });

  it('has aria-label on aside', () => {
    const { container } = render(Sidebar);
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Navegação principal');
  });
});
