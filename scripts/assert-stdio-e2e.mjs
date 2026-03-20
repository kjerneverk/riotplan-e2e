#!/usr/bin/env node
/**
 * Ensures stdio e2e is runnable before `vitest run --project stdio`.
 * Mirrors logic in src/riotplan-install.ts (isStdioE2eBundledOrConfigured).
 */
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const riotplanMarkers = [
  join('node_modules', '@kjerneverk', 'riotplan', 'package.json'),
  join(
    'node_modules',
    '@kjerneverk',
    'riotplan-mcp-http',
    'node_modules',
    '@kjerneverk',
    'riotplan',
    'package.json'
  ),
];

function findRiotplanRoot(startFile) {
  let dir = dirname(resolve(startFile));
  for (;;) {
    for (const rel of riotplanMarkers) {
      const marker = join(dir, rel);
      if (existsSync(marker)) {
        return dirname(marker);
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

if (process.env.RIOTPLAN_E2E_STDIO_SCRIPT?.trim()) {
  process.exit(0);
}

const root = findRiotplanRoot(fileURLToPath(import.meta.url));
if (root && existsSync(join(root, 'dist', 'mcp-server-stdio.js'))) {
  process.exit(0);
}

console.error(
  'riotplan-e2e stdio: set RIOTPLAN_E2E_STDIO_SCRIPT to an absolute path to a stdio MCP server, ' +
    'or install @kjerneverk/riotplan that ships dist/mcp-server-stdio.js.'
);
process.exit(1);
