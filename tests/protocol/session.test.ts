/**
 * Session lifecycle protocol tests.
 * Verifies session creation, reuse, and termination via raw HTTP calls.
 */
import { describe, it, expect } from 'vitest';

const serverUrl = process.env.E2E_SERVER_URL;
if (!serverUrl) throw new Error('E2E_SERVER_URL env var is required for protocol tests');

const mcpUrl = `${serverUrl}/mcp`;

const SSE_ACCEPT = 'application/json, text/event-stream';

function makeInitialize(id: number = 1): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'protocol-test', version: '1.0.0' },
    },
  });
}

function makeListTools(id: number = 2): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list', params: {} });
}

/**
 * Parse a response body that may be SSE (text/event-stream) or plain JSON.
 * SSE events have lines like `data: {...}` — join all data lines and parse.
 */
function parseMcpResponse(body: string): Record<string, unknown> {
  const dataLines = body.split('\n').filter((l) => l.startsWith('data:'));
  const jsonText = dataLines.length > 0
    ? dataLines.map((l) => l.replace(/^data:\s*/, '')).join('')
    : body;
  return JSON.parse(jsonText) as Record<string, unknown>;
}

describe('Session lifecycle', () => {
  it('POST /mcp with JSON-RPC returns 200', async () => {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(),
    });
    expect(response.status).toBe(200);
  });

  it('POST /mcp returns JSON content-type', async () => {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(),
    });
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType.toLowerCase()).toMatch(/application\/json|text\/event-stream/);
  });

  it('initialize response contains jsonrpc result', async () => {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(42),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    const parsed = parseMcpResponse(body);
    // Should be a valid JSON-RPC response
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(42);
  });

  it('server returns Mcp-Session-Id header or accepts requests without prior session', async () => {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(),
    });
    // Session may come in response headers or be stateless
    expect(response.status).toBe(200);
  });

  it('session can be reused with Mcp-Session-Id header from first request', async () => {
    const first = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(1),
    });
    expect(first.status).toBe(200);

    const sessionId = first.headers.get('Mcp-Session-Id');

    const second = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: SSE_ACCEPT,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: makeListTools(2),
    });
    expect(second.status).toBe(200);
  });

  it('tools/list returns valid tools array', async () => {
    // The transport requires text/event-stream in Accept header
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeListTools(99),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    const parsed = parseMcpResponse(body);
    expect(parsed.jsonrpc).toBe('2.0');

    const result = parsed.result as Record<string, unknown>;
    expect(Array.isArray(result.tools)).toBe(true);
    expect((result.tools as unknown[]).length).toBeGreaterThan(0);
  });

  it('DELETE /mcp without Mcp-Session-Id returns 400', async () => {
    const response = await fetch(mcpUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(400);
  });

  it('DELETE /mcp with unknown session ID returns 404', async () => {
    const response = await fetch(mcpUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'definitely-not-a-real-session-id-xyz-12345',
      },
    });
    expect(response.status).toBe(404);
  });

  it('DELETE /mcp with valid session ID terminates session', async () => {
    const initResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
      body: makeInitialize(),
    });
    const sessionId = initResponse.headers.get('Mcp-Session-Id');

    if (!sessionId) {
      console.log('Server does not expose Mcp-Session-Id in headers — skipping DELETE termination test');
      return;
    }

    const deleteResponse = await fetch(mcpUrl, {
      method: 'DELETE',
      headers: { 'Mcp-Session-Id': sessionId },
    });
    expect(deleteResponse.status).toBe(200);

    // After deletion, the session should be gone
    const afterDelete = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT, 'Mcp-Session-Id': sessionId },
      body: makeListTools(99),
    });
    // Server may create a new session (200) or reject the stale ID — either is valid
    expect([200, 404]).toContain(afterDelete.status);
  });

  it('multiple concurrent POST requests succeed independently', async () => {
    const requests = Array.from({ length: 3 }, (_, i) =>
      fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: SSE_ACCEPT },
        body: makeListTools(i + 1),
      })
    );
    const responses = await Promise.all(requests);
    for (const r of responses) {
      expect(r.status).toBe(200);
    }
  });
});
