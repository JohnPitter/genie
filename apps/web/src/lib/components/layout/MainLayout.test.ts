import { render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { chatPanelOpen, sidebarCollapsed } from '$lib/stores/ui';

// Mock $app/stores for Sidebar (used inside MainLayout)
import { vi } from 'vitest';
vi.mock('$app/stores', () => {
  const { readable } = require('svelte/store');
  return {
    page: readable({ url: { pathname: '/' } }),
    navigating: readable(null),
    updated: readable(false),
  };
});

import MainLayout from './MainLayout.svelte';

describe('MainLayout', () => {
  beforeEach(() => {
    chatPanelOpen.set(false);
    sidebarCollapsed.set(false);
  });

  it('renders without crash', () => {
    const { container } = render(MainLayout);
    expect(container.querySelector('.layout')).not.toBeNull();
  });

  it('renders sidebar', () => {
    const { container } = render(MainLayout);
    expect(container.querySelector('.sidebar')).not.toBeNull();
  });

  it('renders main content area', () => {
    const { container } = render(MainLayout);
    expect(container.querySelector('.layout__main')).not.toBeNull();
  });

  it('chat panel is hidden when chatPanelOpen is false', () => {
    chatPanelOpen.set(false);
    const { container } = render(MainLayout);
    expect(container.querySelector('.layout__chat')).toBeNull();
  });

  it('chat panel is visible when chatPanelOpen is true', async () => {
    chatPanelOpen.set(true);
    const { container } = render(MainLayout);
    expect(container.querySelector('.layout__chat')).not.toBeNull();
  });

  it('chatPanelOpen store initial value is false', () => {
    expect(get(chatPanelOpen)).toBe(false);
  });

  it('chatPanelOpen store toggle works', () => {
    chatPanelOpen.set(true);
    expect(get(chatPanelOpen)).toBe(true);
    chatPanelOpen.set(false);
    expect(get(chatPanelOpen)).toBe(false);
  });
});
