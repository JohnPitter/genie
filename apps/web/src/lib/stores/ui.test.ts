import { get } from 'svelte/store';
import { describe, it, expect } from 'vitest';
import { chatPanelOpen, sidebarCollapsed, activeRoute } from './ui';

describe('ui stores', () => {
  it('chatPanelOpen has initial value false', () => {
    expect(get(chatPanelOpen)).toBe(false);
  });

  it('sidebarCollapsed has initial value false', () => {
    expect(get(sidebarCollapsed)).toBe(false);
  });

  it('activeRoute has initial value "/"', () => {
    expect(get(activeRoute)).toBe('/');
  });

  it('chatPanelOpen can be toggled', () => {
    chatPanelOpen.set(true);
    expect(get(chatPanelOpen)).toBe(true);
    chatPanelOpen.set(false);
    expect(get(chatPanelOpen)).toBe(false);
  });

  it('sidebarCollapsed can be toggled', () => {
    sidebarCollapsed.set(true);
    expect(get(sidebarCollapsed)).toBe(true);
    sidebarCollapsed.set(false);
    expect(get(sidebarCollapsed)).toBe(false);
  });

  it('activeRoute updates correctly', () => {
    activeRoute.set('/favorites');
    expect(get(activeRoute)).toBe('/favorites');
    activeRoute.set('/settings');
    expect(get(activeRoute)).toBe('/settings');
    activeRoute.set('/');
    expect(get(activeRoute)).toBe('/');
  });

  it('chatPanelOpen subscribers receive updates', () => {
    const values: boolean[] = [];
    const unsubscribe = chatPanelOpen.subscribe((v) => values.push(v));
    chatPanelOpen.set(true);
    chatPanelOpen.set(false);
    unsubscribe();
    expect(values).toEqual([false, true, false]);
  });
});
