import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpToolError } from './types.js';

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    throw new McpToolError(name, result);
  }

  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new McpToolError(name, 'Empty response content');
  }

  const firstContent = content[0];
  if (firstContent.type !== 'text') {
    throw new McpToolError(name, `Unexpected content type: ${firstContent.type}`);
  }

  try {
    return JSON.parse(firstContent.text);
  } catch {
    // Some tools return plain text (not JSON)
    return firstContent.text;
  }
}

export async function listToolNames(client: Client): Promise<string[]> {
  const result = await client.listTools();
  return result.tools.map((t) => t.name);
}

export async function readResource(client: Client, uri: string): Promise<string> {
  const result = await client.readResource({ uri });
  const content = result.contents[0];
  if ('text' in content) return content.text;
  throw new Error(`Resource ${uri} returned non-text content`);
}

/**
 * Asserts a tool call succeeds and returns the parsed result.
 * Throws McpToolError with details if the tool reports an error.
 */
export async function expectToolSuccess(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await callTool(client, name, args);
  return result as Record<string, unknown>;
}
