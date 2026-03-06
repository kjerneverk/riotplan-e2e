import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool } from '../../src/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function expectStage(client: Client, planId: string, expectedStage: string): Promise<void> {
  const ctx = await callTool(client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
  expect(ctx.stage, `Expected plan '${planId}' to be in stage '${expectedStage}'`).toBe(expectedStage);
}

export async function expectProgress(
  client: Client,
  planId: string,
  completed: number,
  total: number
): Promise<void> {
  const status = await callTool(client, 'riotplan_status', { planId }) as Record<string, unknown>;
  const progress = status.progress as Record<string, unknown>;
  expect(progress.completed, `Expected ${completed} completed steps`).toBe(completed);
  expect(progress.total, `Expected ${total} total steps`).toBe(total);
}

export async function expectContextContains(
  client: Client,
  planId: string,
  field: string,
  substring: string
): Promise<void> {
  const ctx = await callTool(client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
  const fieldValue = JSON.stringify(ctx[field] ?? ctx);
  expect(fieldValue, `Expected context field '${field}' to contain '${substring}'`).toContain(substring);
}

export function readFixture(relativePath: string): string {
  const fixturesDir = join(__dirname, '..', '..', 'fixtures');
  return readFileSync(join(fixturesDir, relativePath), 'utf-8');
}
