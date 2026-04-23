import { writable } from 'svelte/store';

export const chatPanelOpen = writable(false);
export const sidebarCollapsed = writable(false);
/** Mobile-only drawer state. On desktop the sidebar is always visible. */
export const sidebarOpen = writable(false);
export const activeRoute = writable('/');
