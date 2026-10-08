import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any sub-path (e.g. GitHub Pages /repo-name/)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
