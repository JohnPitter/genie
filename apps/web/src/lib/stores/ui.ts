import { writable } from 'svelte/store';

export const chatPanelOpen = writable(false);
export const sidebarCollapsed = writable(false);
export const activeRoute = writable('/');
