import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupTempDir } from './temp.js';

export interface ServerConfig {
  transport: 'http';
  port?: number;
  plansDir: string;
}

interface LaunchCommand {
  command: string;
  args: string[];
  cwd?: string;
}

function resolveRiotplanHttpLaunch(): LaunchCommand {
  // Resolve relative to this file's location: go up to project root, into node_modules
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // thisDir is riotplan-e2e/src, so project root is one level up
  const projectRoot = join(thisDir, '..');
  const localSourcePackageRoot = process.env.RIOTPLAN_E2E_HTTP_PACKAGE_ROOT
    ?? join(projectRoot, '..', 'riotplan-mcp-http');
  const localSourceEntrypoint = process.env.RIOTPLAN_E2E_HTTP_ENTRYPOINT
    ?? join(localSourcePackageRoot, 'src', 'bin-http.ts');
  const localCommand = join(projectRoot, 'node_modules', '.bin', 'riotplan-mcp-http');

  if (existsSync(localCommand)) {
    return { command: localCommand, args: [] };
  }

  if (existsSync(localSourceEntrypoint)) {
    return { command: 'npx', args: ['-y', 'tsx', localSourceEntrypoint], cwd: localSourcePackageRoot };
  }

  const npmPackage = process.env.RIOTPLAN_E2E_NPM_PACKAGE ?? '@kjerneverk/riotplan@dev';
  return { command: 'npx', args: ['-y', '-p', npmPackage, 'riotplan-mcp-http'] };
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address();
      server.close(() => {
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        } else {
          reject(new Error('Could not get port'));
        }
      });
    });
  });
}

export class ServerManager {
  private process: ChildProcess | null = null;
  private port: number;
  private readonly plansDir: string;
  private stderrBuffer: string = '';
  private stdoutBuffer: string = '';
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.port = config.port ?? 0;
    this.plansDir = config.plansDir;
  }

  async start(): Promise<void> {
    if (this.port === 0) {
      this.port = await findFreePort();
    }

    const launch = resolveRiotplanHttpLaunch();

    this.process = spawn(launch.command, [...launch.args, '--port', String(this.port), '--plans-dir', this.plansDir], {
      env: { ...process.env },
      cwd: launch.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
    });

    this.process.on('error', (err) => {
      throw new Error(`Server process error: ${err.message}`);
    });

    await this.waitForReady();
  }

  async waitForReady(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const url = `${this.getServerUrl()}/health`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {
        // server not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error(
      `Server did not become ready within ${timeoutMs}ms.\nSTDERR: ${this.stderrBuffer}\nSTDOUT: ${this.stdoutBuffer}`
    );
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5_000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }

    await cleanupTempDir(this.plansDir);
  }

  getServerUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  getPlansDir(): string {
    return this.plansDir;
  }

  getPort(): number {
    return this.port;
  }

  getLogs(): { stdout: string; stderr: string } {
    return { stdout: this.stdoutBuffer, stderr: this.stderrBuffer };
  }
}
