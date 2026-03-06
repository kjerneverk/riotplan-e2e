/**
 * Health endpoint protocol tests.
 * Verifies GET /health returns expected structure without requiring an MCP session.
 */
import { describe, it, expect } from 'vitest';

const serverUrl = process.env.E2E_SERVER_URL;
if (!serverUrl) throw new Error('E2E_SERVER_URL env var is required for protocol tests');

describe('GET /health', () => {
  it('returns 200 status', async () => {
    const response = await fetch(`${serverUrl}/health`);
    expect(response.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const contentType = response.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });

  it('returns status: ok', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });

  it('returns service: riotplan-http', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    expect(body.service).toBe('riotplan-http');
  });

  it('reports tool count > 0', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.tools).toBe('number');
    expect(body.tools as number).toBeGreaterThan(0);
  });

  it('reports resource count > 0', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.resources).toBe('number');
    expect(body.resources as number).toBeGreaterThan(0);
  });

  it('includes endpoints object with mcp and health paths', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    const endpoints = body.endpoints as Record<string, unknown>;
    expect(endpoints).toBeDefined();
    expect(endpoints.mcp).toBe('/mcp');
    expect(endpoints.health).toBe('/health');
  });

  it('health endpoint accessible without authentication headers', async () => {
    const response = await fetch(`${serverUrl}/health`, {
      headers: {}, // no auth, no session
    });
    expect(response.status).toBe(200);
  });

  it('health endpoint accessible via HEAD request', async () => {
    const response = await fetch(`${serverUrl}/health`, { method: 'HEAD' });
    // HEAD should return 200 or 405 (method not allowed) — either is acceptable
    expect([200, 405]).toContain(response.status);
  });

  it('returns secured: false in test environment', async () => {
    const response = await fetch(`${serverUrl}/health`);
    const body = await response.json() as Record<string, unknown>;
    // In our test environment, security is not enabled
    expect(body.secured).toBe(false);
  });
});
