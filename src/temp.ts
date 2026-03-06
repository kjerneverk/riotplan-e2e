import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTempPlansDir(prefix = 'e2e'): Promise<string> {
  return mkdtemp(join(tmpdir(), `riotplan-${prefix}-`));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
