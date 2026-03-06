import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'local-http',
          include: ['tests/scenarios/**/*.test.ts'],
          globalSetup: ['tests/setup/http-global.ts'],
          environment: 'node',
          env: { TRANSPORT: 'http' },
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'stdio',
          include: ['tests/scenarios/**/*.test.ts'],
          globalSetup: ['tests/setup/stdio-global.ts'],
          environment: 'node',
          env: { TRANSPORT: 'stdio' },
          testTimeout: 30_000,
        },
      },
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
