import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { cleanupTempDir } from './temp.js';
import { resolveHttpServerScriptForE2e } from './riotplan-install.js';

export interface ServerConfig {
  transport: 'http';
  port?: number;
  plansDir: string;
}

interface LaunchCommand {
  command: string;
  args: string[];
}

function resolveRiotplanHttpLaunch(): LaunchCommand {
  const script = resolveHttpServerScriptForE2e();
  return { command: process.execPath, args: [script] };
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
