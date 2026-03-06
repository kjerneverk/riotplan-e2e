import { createTempPlansDir, cleanupTempDir } from '../../src/temp.js';

export async function setup() {
  const plansDir = await createTempPlansDir('stdio');
  process.env.E2E_PLANS_DIR = plansDir;
}

export async function teardown() {
  if (process.env.E2E_PLANS_DIR) {
    await cleanupTempDir(process.env.E2E_PLANS_DIR);
    delete process.env.E2E_PLANS_DIR;
  }
}
