import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
