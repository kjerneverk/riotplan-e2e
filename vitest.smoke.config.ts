import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/setup/smoke.test.ts', 'tests/setup/client.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
