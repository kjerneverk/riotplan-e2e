import { defineConfig } from 'vitest/config';
import { isStdioE2eBundledOrConfigured } from './src/riotplan-install.js';

const stdioProject = {
  extends: true as const,
  test: {
    name: 'stdio',
    include: ['tests/scenarios/**/*.test.ts', 'tests/regressions/**/*.test.ts'],
    globalSetup: ['tests/setup/stdio-global.ts'],
    environment: 'node' as const,
    env: { TRANSPORT: 'stdio' },
    testTimeout: 30_000,
  },
};

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'local-http',
          include: [
            'tests/scenarios/**/*.test.ts',
            'tests/regressions/**/*.test.ts',
          ],
          globalSetup: ['tests/setup/http-global.ts'],
          environment: 'node',
          env: { TRANSPORT: 'http' },
          testTimeout: 30_000,
        },
      },
      ...(isStdioE2eBundledOrConfigured() ? [stdioProject] : []),
      {
        extends: true,
        test: {
          name: 'protocol',
          include: ['tests/protocol/**/*.test.ts'],
          globalSetup: ['tests/setup/http-global.ts'],
          environment: 'node',
          testTimeout: 15_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'ai',
          include: ['tests/ai/**/*.test.ts'],
          globalSetup: ['tests/setup/http-global.ts'],
          environment: 'node',
          env: { TRANSPORT: 'http' },
          testTimeout: 120_000,
        },
      },
    ],
  },
});
