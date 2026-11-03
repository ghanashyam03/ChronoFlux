import { defineConfig } from 'vitest/config';

const isCoverage = process.argv.includes('--coverage');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: isCoverage ? { VITEST_COVERAGE: '1' } : {},
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts']
    }
  }
});
