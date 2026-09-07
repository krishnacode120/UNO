import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['packages/shared/src/**/*.test.ts', 'apps/server/src/**/*.test.ts'], testTimeout: 15000 }
});
