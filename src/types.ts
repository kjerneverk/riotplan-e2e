import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type TransportType = 'http' | 'stdio';

export interface ClientConfig {
  transport: TransportType;
  serverUrl?: string;
  plansDir?: string;
}

export interface TestContext {
  client: Client;
  transport: TransportType;
  plansDir: string;
  serverUrl?: string;
}

export interface ServerConfig {
  transport: 'http';
  port?: number;
  plansDir: string;
}

export class McpToolError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly result: unknown
  ) {
    super(`MCP tool '${toolName}' returned an error: ${JSON.stringify(result)}`);
    this.name = 'McpToolError';
  }
}
