import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit + golden run in Node. jsdom is opt-in per-file via `// @vitest-environment jsdom`
    // for the few DOM-touching units (drafts/localStorage). The cutout-engine stays DOM-free.
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts', 'test/golden/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
