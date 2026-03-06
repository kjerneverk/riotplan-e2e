import { describe, it, expect } from 'vitest';
import { ServerManager } from '../../src/server.js';
import { createTempPlansDir } from '../../src/temp.js';

describe('Server lifecycle smoke test', () => {
  it('starts, serves /health, and stops cleanly', async () => {
    const plansDir = await createTempPlansDir('smoke');
    const server = new ServerManager({ transport: 'http', plansDir });

    await server.start();

    const res = await fetch(`${server.getServerUrl()}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toBeDefined();

    await server.stop();
  }, 15_000);
});
