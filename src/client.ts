import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ClientConfig } from './types.js';
import { resolveStdioServerScriptForE2e } from './riotplan-install.js';

interface LaunchCommand {
  command: string;
  args: string[];
}

function resolveRiotplanMcpStdioLaunch(): LaunchCommand {
  const script = resolveStdioServerScriptForE2e();
  return { command: process.execPath, args: [script] };
}

export async function createMcpClient(config: ClientConfig): Promise<Client> {
  let transport;

  if (config.transport === 'http') {
    if (!config.serverUrl) throw new Error('serverUrl required for HTTP transport');
    transport = new StreamableHTTPClientTransport(new URL(`${config.serverUrl}/mcp`));
  } else {
    if (!config.plansDir) throw new Error('plansDir required for STDIO transport');
    const launch = resolveRiotplanMcpStdioLaunch();
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
