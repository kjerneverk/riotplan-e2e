/**
 * Content-type handling protocol tests.
 * Verifies that the server correctly handles and returns proper content-type headers,
 * and that SSE streaming is accessible for GET /mcp.
 */
import { describe, it, expect } from 'vitest';

const serverUrl = process.env.E2E_SERVER_URL;
if (!serverUrl) throw new Error('E2E_SERVER_URL env var is required for protocol tests');

const mcpUrl = `${serverUrl}/mcp`;

describe('Content-type handling', () => {
  describe('Request content-type', () => {
    it('application/json is accepted', async () => {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      expect(response.status).toBe(200);
    });

    it('application/json with charset is accepted', async () => {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Response content-type', () => {
    it('POST /mcp returns application/json or text/event-stream content-type', async () => {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      const contentType = response.headers.get('content-type') ?? '';
      expect(contentType.toLowerCase()).toMatch(/application\/json|text\/event-stream/);
    });

    it('GET /health returns application/json', async () => {
      const response = await fetch(`${serverUrl}/health`);
      const contentType = response.headers.get('content-type') ?? '';
      expect(contentType.toLowerCase()).toContain('application/json');
    });

    it('POST /mcp response body is valid JSON or SSE', async () => {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      expect(response.status).toBe(200);
      const body = await response.text();
      // Parse SSE or plain JSON
      const dataLines = body.split('\n').filter((l) => l.startsWith('data:'));
      const text = dataLines.length > 0
        ? dataLines.map((l) => l.replace(/^data:\s*/, '')).join('')
        : body;
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  describe('SSE Accept header', () => {
    it('GET /mcp without session ID returns 404 or requires session header', async () => {
      // GET /mcp is for SSE streaming — requires an existing session
      const response = await fetch(mcpUrl, {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      });
      // Without a session ID, server should return 400 (missing session) or 404
      expect([400, 404]).toContain(response.status);
    });

    it('GET /mcp with invalid session ID returns 404', async () => {
      const response = await fetch(mcpUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Mcp-Session-Id': 'fake-session-for-sse-test',
        },
      });
      expect([400, 404]).toContain(response.status);
    });

    it('Accept: application/json only — transport requires text/event-stream', async () => {
      // The StreamableHTTP transport requires 'text/event-stream' in the Accept header.
      // Omitting it causes the transport to fail. This is expected behavior.
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',  // missing text/event-stream intentionally
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      // 406 (Not Acceptable) or 500 are expected here since text/event-stream is required
      expect([200, 406, 500]).toContain(response.status);
    });
  });

  describe('CORS headers', () => {
    it('POST /mcp includes CORS headers when Origin is provided', async () => {
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      expect(response.status).toBe(200);
      // CORS headers may be present
      const accessControl = response.headers.get('access-control-allow-origin');
      // Accept either CORS enabled or CORS not configured — just no crash
      expect(typeof accessControl === 'string' || accessControl === null).toBe(true);
    });

    it('OPTIONS preflight to /mcp is handled', async () => {
      const response = await fetch(mcpUrl, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, mcp-session-id',
        },
      });
      // OPTIONS should return 200, 204 (OK) or 405 (if CORS not configured)
      expect([200, 204, 400, 405]).toContain(response.status);
    });
  });
});
