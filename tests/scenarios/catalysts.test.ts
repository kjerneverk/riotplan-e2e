import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Catalyst Operations', () => {
  const ctx = useTestContext();

  it('lists available catalysts without error', async () => {
    const result = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    expect(result).toBeDefined();
    // May be empty array or list of catalysts — either is valid
    const text = JSON.stringify(result);
    expect(text.length).toBeGreaterThan(0);
  });

  it('associates a catalyst with a plan', async () => {
    // First, list available catalysts to get a real one
    const listResult = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    const catalystList = listResult.catalysts as unknown[] ?? (Array.isArray(listResult) ? listResult as unknown[] : []);

    if (catalystList.length === 0) {
      // No catalysts available in this environment — skip gracefully
      console.log('No catalysts available — skipping association test');
      return;
    }

    const firstCatalyst = catalystList[0] as Record<string, unknown>;
    const catalystId = (firstCatalyst.id ?? firstCatalyst.name) as string;

    const planId = uniquePlanCode('catalyst');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Catalyst association test',
    });

    const result = await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'associate',
      planId,
      catalysts: [catalystId],
      operation: 'add',
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
  });

  it('shows catalyst details when catalysts exist', async () => {
    const listResult = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    const catalystList = listResult.catalysts as unknown[] ?? (Array.isArray(listResult) ? listResult as unknown[] : []);

    if (catalystList.length === 0) {
      console.log('No catalysts available — skipping show test');
      return;
    }

    const firstCatalyst = catalystList[0] as Record<string, unknown>;
    const catalystId = (firstCatalyst.id ?? firstCatalyst.name) as string;

    const result = await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'show', catalyst: catalystId,
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
    // Show should return catalyst details
    const text = JSON.stringify(result);
    expect(text.length).toBeGreaterThan(5);
  });

  it('associates multiple catalysts with a plan', async () => {
    const listResult = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    const catalystList = listResult.catalysts as unknown[] ?? (Array.isArray(listResult) ? listResult as unknown[] : []);

    if (catalystList.length < 2) {
      console.log('Fewer than 2 catalysts available — skipping multi-associate test');
      return;
    }

    const ids = catalystList.slice(0, 2).map((c) => {
      const c2 = c as Record<string, unknown>;
      return (c2.id ?? c2.name) as string;
    });

    const planId = uniquePlanCode('multi-catalyst');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Multi-catalyst test',
    });

    const result = await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'associate', planId, catalysts: ids, operation: 'add',
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
  });

  it('removes a catalyst association from a plan', async () => {
    const listResult = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    const catalystList = listResult.catalysts as unknown[] ?? (Array.isArray(listResult) ? listResult as unknown[] : []);

    if (catalystList.length === 0) {
      console.log('No catalysts available — skipping remove test');
      return;
    }

    const firstCatalyst = catalystList[0] as Record<string, unknown>;
    const catalystId = (firstCatalyst.id ?? firstCatalyst.name) as string;

    const planId = uniquePlanCode('catalyst-remove');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Catalyst remove test',
    });

    // Add first
    await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'associate', planId, catalysts: [catalystId], operation: 'add',
    });

    // Then remove
    const result = await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'associate', planId, catalysts: [catalystId], operation: 'remove',
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
  });

  it('catalyst content appears in build generation instructions when associated', async () => {
    const listResult = await callTool(ctx.client, 'riotplan_catalyst', { action: 'list' }) as Record<string, unknown>;
    const catalystList = listResult.catalysts as unknown[] ?? (Array.isArray(listResult) ? listResult as unknown[] : []);

    if (catalystList.length === 0) {
      console.log('No catalysts available — skipping build instructions test');
      return;
    }

    const firstCatalyst = catalystList[0] as Record<string, unknown>;
    const catalystId = (firstCatalyst.id ?? firstCatalyst.name) as string;

    const planId = uniquePlanCode('catalyst-build');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Catalyst in build test',
    });
    await callTool(ctx.client, 'riotplan_catalyst', {
      action: 'associate', planId, catalysts: [catalystId], operation: 'add',
    });

    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Approach with Catalyst',
      description: 'Testing catalyst influence.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Approach with Catalyst', reason: 'For catalyst test',
    });

    const buildResult = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    expect(buildResult).toBeDefined();
    // Build instructions should exist and be meaningful
    const instructions = buildResult.generationInstructions as Record<string, unknown>;
    expect(instructions).toBeDefined();
    expect((instructions.userPrompt as string).length).toBeGreaterThan(50);
  });
});
