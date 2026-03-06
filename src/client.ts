import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientConfig } from './types.js';

function resolveRiotplanMcpBinary(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(thisDir, '..');
  return join(projectRoot, 'node_modules', '@kjerneverk', 'riotplan', 'dist', 'mcp-server.js');
}

export async function createMcpClient(config: ClientConfig): Promise<Client> {
  let transport;

  if (config.transport === 'http') {
    if (!config.serverUrl) throw new Error('serverUrl required for HTTP transport');
    transport = new StreamableHTTPClientTransport(new URL(`${config.serverUrl}/mcp`));
  } else {
    if (!config.plansDir) throw new Error('plansDir required for STDIO transport');
    transport = new StdioClientTransport({
      command: 'node',
      args: [resolveRiotplanMcpBinary()],
      env: { ...process.env, RIOTPLAN_PLAN_DIRECTORY: config.plansDir },
    });
  }

  const client = new Client({ name: 'riotplan-e2e', version: '1.0.0' });
  await client.connect(transport);
  return client;
}
