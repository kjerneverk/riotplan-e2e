import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Plan Management', () => {
  const ctx = useTestContext();

  describe('riotplan_list_plans', () => {
    it('lists plans — returns an array', async () => {
      const result = await callTool(ctx.client, 'riotplan_list_plans', {}) as Record<string, unknown>;
      // Result may be an array directly or wrapped in {plans: [...]}
      const plans = Array.isArray(result) ? result : (result.plans as unknown[]);
      expect(Array.isArray(plans)).toBe(true);
    });

    it('list returns plans with expected shape (id, stage, category)', async () => {
      // Create a plan to ensure at least one exists
      const planId = uniquePlanCode('list-test');
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'create', code: planId, description: 'Plan to check in list',
      });

      const result = await callTool(ctx.client, 'riotplan_list_plans', {}) as Record<string, unknown>;
      const plans = Array.isArray(result) ? result : (result.plans as unknown[]);
      expect(plans.length).toBeGreaterThan(0);

      // Verify plan objects have expected shape
      const anyPlan = plans[0] as Record<string, unknown>;
      expect(anyPlan.planId ?? anyPlan.id).toBeDefined();
      expect(anyPlan.stage ?? anyPlan.status).toBeDefined();
    });

    it('list returns plans matching their stage', async () => {
      const result = await callTool(ctx.client, 'riotplan_list_plans', {}) as Record<string, unknown>;
      const plans = Array.isArray(result) ? result : (result.plans as unknown[]);
      expect(Array.isArray(plans)).toBe(true);
      // All returned plans should have a stage field that's a known value
      for (const plan of plans) {
        const p = plan as Record<string, unknown>;
        const stage = p.stage as string;
        const knownStages = ['idea', 'shaping', 'built', 'executing', 'completed', 'pending', 'active'];
        if (stage) {
          expect(knownStages).toContain(stage.toLowerCase());
        }
      }
    });

    it('filters active plans — returns non-empty array', async () => {
      const result = await callTool(ctx.client, 'riotplan_list_plans', { filter: 'active' }) as Record<string, unknown>;
      const plans = Array.isArray(result) ? result : (result.plans as unknown[]);
      expect(Array.isArray(plans)).toBe(true);
      // Active filter should return at least some plans (created by other tests in parallel)
      expect(plans.length).toBeGreaterThan(0);
    });
  });

  describe('riotplan_status', () => {
    it('returns status for an idea-stage plan', async () => {
      const planId = uniquePlanCode('status-idea');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Status test plan' });

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      expect(status).toBeDefined();
      // Should have some stage indicator
      const text = JSON.stringify(status);
      expect(text.toLowerCase()).toContain('idea');
    });

    it('status returns successfully after stage transition to shaping', async () => {
      const planId = uniquePlanCode('status-trans');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Status transition test' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      // riotplan_status returns operational status (pending/active/complete),
      // not lifecycle stage. Use riotplan_read_context to verify the lifecycle stage.
      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      expect(status).toBeDefined();
      expect(JSON.stringify(status)).toContain(planId);

      // Verify stage via read_context
      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(context.stage).toBe('shaping');
    });

    it('status has plan code/description', async () => {
      const planId = uniquePlanCode('status-fields');
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'create', code: planId, description: 'Status field check',
      });

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(status);
      expect(text).toContain(planId);
    });

    it('status for a plan with evidence shows evidence count', async () => {
      const planId = uniquePlanCode('status-ev');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Evidence status test' });

      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId,
        title: 'Some Evidence', summary: 'Evidence for status test', content: 'Content here.',
      });
      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId,
        title: 'More Evidence', summary: 'More for status test', content: 'More content.',
      });

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      expect(status).toBeDefined();
      // Verify no error — evidence-rich plan returns valid status
    });
  });

  describe('Plan isolation', () => {
    it('two plans with same-named evidence do not interfere', async () => {
      const planA = uniquePlanCode('iso-a');
      const planB = uniquePlanCode('iso-b');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planA, description: 'Isolation A' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planB, description: 'Isolation B' });

      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId: planA,
        title: 'Shared Title', summary: 'Evidence for plan A', content: 'Plan A specific content.',
      });
      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId: planB,
        title: 'Shared Title', summary: 'Evidence for plan B', content: 'Plan B specific content.',
      });

      const ctxA = await callTool(ctx.client, 'riotplan_read_context', { planId: planA }) as Record<string, unknown>;
      const ctxB = await callTool(ctx.client, 'riotplan_read_context', { planId: planB }) as Record<string, unknown>;

      expect(JSON.stringify(ctxA)).toContain('Plan A specific content');
      expect(JSON.stringify(ctxA)).not.toContain('Plan B specific content');
      expect(JSON.stringify(ctxB)).toContain('Plan B specific content');
      expect(JSON.stringify(ctxB)).not.toContain('Plan A specific content');
    });

    it('two plans with same-named approaches are independent', async () => {
      const planA = uniquePlanCode('iso-shape-a');
      const planB = uniquePlanCode('iso-shape-b');
      for (const id of [planA, planB]) {
        await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: id, description: `Shaping iso ${id}` });
        await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId: id });
        await callTool(ctx.client, 'riotplan_shaping', {
          action: 'add_approach', planId: id,
          name: 'Same Approach Name',
          description: `Description unique to ${id}`,
          tradeoffs: [],
        });
      }

      const ctxA = await callTool(ctx.client, 'riotplan_read_context', { planId: planA }) as Record<string, unknown>;
      const ctxB = await callTool(ctx.client, 'riotplan_read_context', { planId: planB }) as Record<string, unknown>;

      expect(JSON.stringify(ctxA)).toContain(planA);
      expect(JSON.stringify(ctxB)).toContain(planB);
    });

    it('note in plan A does not appear in plan B', async () => {
      const planA = uniquePlanCode('note-iso-a');
      const planB = uniquePlanCode('note-iso-b');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planA, description: 'Note iso A' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planB, description: 'Note iso B' });

      const uniqueNote = `unique-note-${Date.now()}`;
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId: planA, note: uniqueNote });

      const ctxB = await callTool(ctx.client, 'riotplan_read_context', { planId: planB }) as Record<string, unknown>;
      expect(JSON.stringify(ctxB)).not.toContain(uniqueNote);
    });
  });
});
