import { beforeAll, afterAll } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpClient } from '../../src/client.js';
import type { TestContext, TransportType } from '../../src/types.js';

/**
 * Returns a TestContext that sets up and tears down an MCP client
 * for the current transport (read from E2E_TRANSPORT env var).
 *
 * Usage in test files:
 *   const ctx = useTestContext();
 *   it('does something', async () => {
 *     const result = await callTool(ctx.client, ...);
 *   });
 */
export function useTestContext(): TestContext {
  const transport = (process.env.TRANSPORT ?? 'http') as TransportType;
  const serverUrl = process.env.E2E_SERVER_URL;
  const plansDir = process.env.E2E_PLANS_DIR ?? '';

  // Use a container so the reference stays stable across tests
  const ctx: TestContext = {
    get client(): Client {
      return _client!;
    },
    transport,
    plansDir,
    serverUrl,
  };

  let _client: Client | null = null;

  beforeAll(async () => {
    _client = await createMcpClient({ transport, serverUrl, plansDir });
  });

  afterAll(async () => {
    await _client?.close();
    _client = null;
  });

  return ctx;
}

/**
 * Generates a unique plan code for test isolation.
 * Each test file should use this to avoid plan name collisions.
 */
export function uniquePlanCode(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
