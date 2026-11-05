import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      'time-2.0': path.resolve(__dirname, '../../src/index.ts'),
      '@chronoflux/core': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist-visualizer'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
