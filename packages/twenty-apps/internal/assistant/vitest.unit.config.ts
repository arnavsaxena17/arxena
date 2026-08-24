import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['src/**/*.integration-test.ts'],
  },
});
