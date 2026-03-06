import { describe, it, expect } from 'vitest';
import { ServerManager } from '../../src/server.js';
import { createTempPlansDir } from '../../src/temp.js';
import { createMcpClient } from '../../src/client.js';
import { listToolNames } from '../../src/helpers.js';

describe('MCP client factory - HTTP transport', () => {
  it('connects and lists tools', async () => {
    const plansDir = await createTempPlansDir('client-http');
    const server = new ServerManager({ transport: 'http', plansDir });
    await server.start();

    const client = await createMcpClient({ transport: 'http', serverUrl: server.getServerUrl() });
    const tools = await listToolNames(client);

    expect(tools).toContain('riotplan_idea');
    expect(tools).toContain('riotplan_shaping');
    expect(tools).toContain('riotplan_build');
    expect(tools).toContain('riotplan_step');
    expect(tools).toContain('riotplan_status');
    expect(tools.length).toBeGreaterThan(10);

    await client.close();
    await server.stop();
  }, 15_000);
});

describe('MCP client factory - STDIO transport', () => {
  it('connects and lists tools', async () => {
    const plansDir = await createTempPlansDir('client-stdio');
    const client = await createMcpClient({ transport: 'stdio', plansDir });
    const tools = await listToolNames(client);

    expect(tools).toContain('riotplan_idea');
    expect(tools).toContain('riotplan_shaping');
    expect(tools).toContain('riotplan_build');
    expect(tools).toContain('riotplan_step');
    expect(tools).toContain('riotplan_status');
    expect(tools.length).toBeGreaterThan(10);

    await client.close();
    await cleanupTempDir(plansDir);
  }, 15_000);
});

async function cleanupTempDir(dir: string) {
  const { cleanupTempDir: cleanup } = await import('../../src/temp.js');
  await cleanup(dir);
}
