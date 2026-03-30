import { dirname, isAbsolute, join, resolve } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function toRealPath(path: string): string {
  const resolved = resolve(path);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function assertAbsoluteEnv(name: string, value: string): string {
  const expanded = resolve(value.trim());
  if (!isAbsolute(expanded)) {
    throw new Error(`${name} must be an absolute path (after resolve); got: ${value}`);
  }
  return toRealPath(expanded);
}

const RIOTPLAN_PACKAGE_MARKERS = [
  join('node_modules', '@planvokter', 'riotplan', 'package.json'),
  join(
    'node_modules',
    '@planvokter',
    'riotplan-mcp-http',
    'node_modules',
    '@planvokter',
    'riotplan',
    'package.json'
  ),
] as const;

/**
 * Find `node_modules/@planvokter/riotplan` by walking up from a file (no `require.resolve` —
 * the published package is ESM-only and does not expose a resolvable CJS main).
 * Checks hoisted install and copy nested under `@planvokter/riotplan-mcp-http`.
 */
function findRiotplanPackageRootFromFile(startFile: string): string {
  let dir = dirname(resolve(startFile));
  for (;;) {
    for (const rel of RIOTPLAN_PACKAGE_MARKERS) {
      const marker = join(dir, rel);
      if (existsSync(marker)) {
        return toRealPath(dirname(marker));
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find @planvokter/riotplan under node_modules (walked up from riotplan-e2e). ' +
          'Run npm install (riotplan is installed with @planvokter/riotplan-mcp-http) or set RIOTPLAN_E2E_HTTP_SCRIPT.'
      );
    }
    dir = parent;
  }
}

/** Root of the installed `@planvokter/riotplan` package (realpath). */
export function getRiotplanPackageRoot(): string {
  return findRiotplanPackageRootFromFile(fileURLToPath(import.meta.url));
}

const MCP_HTTP_PACKAGE_MARKERS = [
  join('node_modules', '@planvokter', 'riotplan-mcp-http', 'package.json'),
  join('node_modules', '@planvokter', 'riotplan', 'node_modules', '@planvokter', 'riotplan-mcp-http', 'package.json'),
] as const;

function readMcpHttpBinEntry(packageRoot: string): string | null {
  try {
    const raw = readFileSync(join(packageRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { bin?: Record<string, string> };
    const rel = pkg.bin?.['riotplan-mcp-http'];
    if (typeof rel !== 'string') return null;
    return join(packageRoot, rel.replace(/^\.\//, ''));
  } catch {
    return null;
  }
}

/** Resolve `riotplan-mcp-http` CLI script by walking up from `startFile` (hoisted or nested under riotplan). */
function tryResolveMcpHttpScriptFromWalk(startFile: string): string | null {
  let dir = dirname(resolve(startFile));
  for (;;) {
    for (const marker of MCP_HTTP_PACKAGE_MARKERS) {
      const pkgJson = join(dir, marker);
      if (existsSync(pkgJson)) {
        const script = readMcpHttpBinEntry(dirname(pkgJson));
        if (script && existsSync(script)) {
          return toRealPath(script);
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Default HTTP MCP entry: prefer `@planvokter/riotplan-mcp-http`,
 * else legacy `dist/mcp-server-http.js` inside `@planvokter/riotplan`.
 */
export function resolveBundledHttpServerScript(): string {
  const start = fileURLToPath(import.meta.url);
  const fromMcp = tryResolveMcpHttpScriptFromWalk(start);
  if (fromMcp) {
    return fromMcp;
  }
  const legacy = join(getRiotplanPackageRoot(), 'dist', 'mcp-server-http.js');
  if (existsSync(legacy)) {
    return toRealPath(legacy);
  }
  throw new Error(
    'Could not resolve HTTP MCP server: install @planvokter/riotplan-mcp-http (or a riotplan build that ' +
      'still ships dist/mcp-server-http.js), or set RIOTPLAN_E2E_HTTP_SCRIPT to an absolute path.'
  );
}

/**
 * HTTP MCP server script for e2e: optional override, otherwise bundled release artifact.
 * `RIOTPLAN_E2E_HTTP_SCRIPT` must be absolute.
 */
export function resolveHttpServerScriptForE2e(): string {
  const override = process.env.RIOTPLAN_E2E_HTTP_SCRIPT?.trim();
  if (override) {
    return assertAbsoluteEnv('RIOTPLAN_E2E_HTTP_SCRIPT', override);
  }
  return resolveBundledHttpServerScript();
}

/**
 * Stdio MCP entry: optional override, else `dist/mcp-server-stdio.js` if the release includes it.
 * `RIOTPLAN_E2E_STDIO_SCRIPT` must be absolute.
 */
export function resolveStdioServerScriptForE2e(): string {
  const override = process.env.RIOTPLAN_E2E_STDIO_SCRIPT?.trim();
  if (override) {
    return assertAbsoluteEnv('RIOTPLAN_E2E_STDIO_SCRIPT', override);
  }
  const bundled = join(getRiotplanPackageRoot(), 'dist', 'mcp-server-stdio.js');
  if (existsSync(bundled)) {
    return toRealPath(bundled);
  }
  throw new Error(
    'Stdio MCP: @planvokter/riotplan has no dist/mcp-server-stdio.js in this version. ' +
      'Set RIOTPLAN_E2E_STDIO_SCRIPT to an absolute path to a Node script that speaks MCP over stdio, ' +
      'or run HTTP-only tests (npm test / npm run test:http).'
  );
}

/** Whether the stdio Vitest project should be registered (bundled stdio server or explicit script). */
export function isStdioE2eBundledOrConfigured(): boolean {
  if (process.env.RIOTPLAN_E2E_STDIO_SCRIPT?.trim()) {
    return true;
  }
  try {
    const bundled = join(getRiotplanPackageRoot(), 'dist', 'mcp-server-stdio.js');
    return existsSync(bundled);
  } catch {
    return false;
  }
}
