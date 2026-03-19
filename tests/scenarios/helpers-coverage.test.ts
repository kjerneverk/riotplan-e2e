import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  callTool,
  expectToolSuccess,
  listToolNames,
  readResource,
} from '../../src/helpers.js';
import {
  expectContextContains,
  expectProgress,
  expectStage,
  readFixture,
} from './helpers.js';

type ToolResult = {
  isError: boolean;
  content: Array<{ type: string; text?: string }>;
};

function textResult(text: string): ToolResult {
  return { isError: false, content: [{ type: 'text', text }] };
}

function createToolClient(
  responses: Record<string, ToolResult>,
  fallback?: ToolResult
): Client {
  return {
    callTool: vi.fn(async ({ name }: { name: string }) => {
      const result = responses[name] ?? fallback;
      if (!result) return textResult('{}');
      return result;
    }),
  } as unknown as Client;
}

describe('src/helpers coverage', () => {
  it('parses JSON payloads from tool responses', async () => {
    const client = createToolClient({
      alpha: textResult('{"ok":true,"value":42}'),
    });

    const result = await callTool(client, 'alpha', {});
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('returns plain text payloads when JSON parsing fails', async () => {
    const client = createToolClient({
      alpha: textResult('plain text response'),
    });

    const result = await callTool(client, 'alpha', {});
    expect(result).toBe('plain text response');
  });

  it('throws for tool-level errors', async () => {
    const client = createToolClient({
      alpha: { isError: true, content: [{ type: 'text', text: 'boom' }] },
    });

    await expect(callTool(client, 'alpha', {})).rejects.toThrow("MCP tool 'alpha' returned an error");
  });

  it('throws for empty content arrays', async () => {
    const client = createToolClient({
      alpha: { isError: false, content: [] },
    });

    await expect(callTool(client, 'alpha', {})).rejects.toThrow('Empty response content');
  });

  it('throws for non-text content', async () => {
    const client = {
      callTool: vi.fn(async () => ({
        isError: false,
        content: [{ type: 'image' }],
      })),
    } as unknown as Client;

    await expect(callTool(client, 'alpha', {})).rejects.toThrow('Unexpected content type: image');
  });

  it('maps tool names from listTools()', async () => {
    const client = {
      listTools: vi.fn(async () => ({
        tools: [{ name: 'riotplan_status' }, { name: 'riotplan_step' }],
      })),
    } as unknown as Client;

    await expect(listToolNames(client)).resolves.toEqual(['riotplan_status', 'riotplan_step']);
  });

  it('reads text resources and rejects non-text resources', async () => {
    const textClient = {
      readResource: vi.fn(async () => ({
        contents: [{ uri: 'x', mimeType: 'text/plain', text: 'hello' }],
      })),
    } as unknown as Client;

    await expect(readResource(textClient, 'riotplan://x')).resolves.toBe('hello');

    const binaryClient = {
      readResource: vi.fn(async () => ({
        contents: [{ uri: 'x', mimeType: 'application/octet-stream', blob: 'AA==' }],
      })),
    } as unknown as Client;

    await expect(readResource(binaryClient, 'riotplan://x')).rejects.toThrow(
      'Resource riotplan://x returned non-text content'
    );
  });

  it('returns parsed records from expectToolSuccess', async () => {
    const client = createToolClient({
      alpha: textResult('{"status":"ok"}'),
    });

    await expect(expectToolSuccess(client, 'alpha', {})).resolves.toEqual({ status: 'ok' });
  });
});

describe('tests/scenarios/helpers coverage', () => {
  it('asserts stage from riotplan_read_context', async () => {
    const client = createToolClient({
      riotplan_read_context: textResult('{"stage":"built"}'),
    });

    await expect(expectStage(client, 'plan-a', 'built')).resolves.toBeUndefined();
  });

  it('asserts progress counts from riotplan_status', async () => {
    const client = createToolClient({
      riotplan_status: textResult('{"progress":{"completed":2,"total":3}}'),
    });

    await expect(expectProgress(client, 'plan-a', 2, 3)).resolves.toBeUndefined();
  });

  it('checks substring in explicit context field', async () => {
    const client = createToolClient({
      riotplan_read_context: textResult('{"notes":"contains target text"}'),
    });

    await expect(expectContextContains(client, 'plan-a', 'notes', 'target')).resolves.toBeUndefined();
  });

  it('checks substring in full context when field is missing', async () => {
    const client = createToolClient({
      riotplan_read_context: textResult('{"summary":"fallback works"}'),
    });

    await expect(expectContextContains(client, 'plan-a', 'missing', 'fallback')).resolves.toBeUndefined();
  });

  it('reads fixture files from fixtures directory', () => {
    const content = readFixture('lifecycle/summary.md');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('# Summary');
  });
});
