import { defineConfig } from 'vitest/config';
import path from 'path';

const isCoverage = process.argv.includes('--coverage');

export default defineConfig({
  resolve: {
    alias: {
      'time-2.0': path.resolve(__dirname, 'src/index.ts'),
      '@chronoflux/core': path.resolve(__dirname, 'src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    env: isCoverage ? { VITEST_COVERAGE: '1' } : {},
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/visualizer/**']
    }
  }
});
