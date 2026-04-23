import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': 'http://localhost:5858',
      '/health': 'http://localhost:5858',
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // DOM tests (components) use jsdom; token tests (theme) use node
    environmentMatchGlobs: [
      ['src/lib/components/**/*.test.ts', 'jsdom'],
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['src/lib/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/lib/**/*.svelte'],
      exclude: ['src/lib/test-setup.ts'],
      reporter: ['text', 'html'],
    },
  }
});
