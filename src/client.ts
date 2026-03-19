import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientConfig } from './types.js';

interface LaunchCommand {
  command: string;
  args: string[];
}

function resolveRiotplanMcpLaunch(): LaunchCommand {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(thisDir, '..');
  const localCommand = join(projectRoot, 'node_modules', '.bin', 'riotplan-mcp');

  if (existsSync(localCommand)) {
    return { command: localCommand, args: [] };
  }

  const npmPackage = process.env.RIOTPLAN_E2E_NPM_PACKAGE ?? '@kjerneverk/riotplan@dev';
  return { command: 'npx', args: ['-y', '-p', npmPackage, 'riotplan-mcp'] };
}

export async function createMcpClient(config: ClientConfig): Promise<Client> {
  let transport;

  if (config.transport === 'http') {
    if (!config.serverUrl) throw new Error('serverUrl required for HTTP transport');
    transport = new StreamableHTTPClientTransport(new URL(`${config.serverUrl}/mcp`));
  } else {
    if (!config.plansDir) throw new Error('plansDir required for STDIO transport');
    const launch = resolveRiotplanMcpLaunch();
    transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args,
      env: { ...process.env, RIOTPLAN_PLAN_DIRECTORY: config.plansDir },
    });
  }

  const client = new Client({ name: 'riotplan-e2e', version: '1.0.0' });
  await client.connect(transport);
  return client;
}
