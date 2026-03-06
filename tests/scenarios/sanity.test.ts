import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { listToolNames, callTool } from '../../src/helpers.js';

describe('Sanity: MCP connection and basic tool availability', () => {
  const ctx = useTestContext();

  it('has the expected riotplan tools available', async () => {
    const tools = await listToolNames(ctx.client);
    const required = [
      'riotplan_idea',
      'riotplan_shaping',
      'riotplan_build',
      'riotplan_step',
      'riotplan_status',
      'riotplan_transition',
      'riotplan_read_context',
      'riotplan_evidence',
      'riotplan_catalyst',
      'riotplan_checkpoint',
      'riotplan_history_show',
    ];
    for (const tool of required) {
      expect(tools, `Expected tool '${tool}' to be available`).toContain(tool);
    }
  });

  it('can create a plan and read its status', async () => {
    const code = uniquePlanCode('sanity');
    const result = await callTool(ctx.client, 'riotplan_idea', {
      action: 'create',
      code,
      description: 'Sanity test plan',
    }) as Record<string, unknown>;

    expect(result.planId).toBe(code);

    const status = await callTool(ctx.client, 'riotplan_status', {
      planId: code,
    }) as Record<string, unknown>;

    expect(status.planId).toBe(code);
  });
});
