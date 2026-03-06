import { ServerManager } from '../../src/server.js';
import { createTempPlansDir } from '../../src/temp.js';

let server: ServerManager;

export async function setup() {
  const plansDir = await createTempPlansDir('http');
  server = new ServerManager({ transport: 'http', plansDir });
  await server.start();
  process.env.E2E_SERVER_URL = server.getServerUrl();
  process.env.E2E_PLANS_DIR = plansDir;
}

export async function teardown() {
  await server?.stop();
  delete process.env.E2E_SERVER_URL;
  delete process.env.E2E_PLANS_DIR;
}
