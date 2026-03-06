import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';
import { buildPlanToExecuting } from '../setup/plan-builder.js';

describe('Step Execution', () => {
  const ctx = useTestContext();

  describe('start / complete cycle', () => {
    it('starts step 1 — status shows it as in_progress', async () => {
      const planId = uniquePlanCode('step-start');
      await buildPlanToExecuting(ctx.client, planId);

      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(status).toLowerCase();
      expect(text).toContain('in_progress');
    });

    it('completes step 1 — status shows it as complete', async () => {
      const planId = uniquePlanCode('step-complete');
      await buildPlanToExecuting(ctx.client, planId);

      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 1 });

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const progress = status.progress as Record<string, unknown>;
      expect(progress.completed).toBeGreaterThanOrEqual(1);
    });

    it('completes all 3 steps sequentially', async () => {
      const planId = uniquePlanCode('step-all');
      await buildPlanToExecuting(ctx.client, planId);

      for (const step of [1, 2, 3]) {
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step });
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step });
      }

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const progress = status.progress as Record<string, unknown>;
      expect(progress.completed).toBe(3);
    });

    it('progress percentage increases as steps complete', async () => {
      const planId = uniquePlanCode('step-progress');
      await buildPlanToExecuting(ctx.client, planId);

      const s0 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const p0 = (s0.progress as Record<string, unknown>).completed as number;

      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 1 });

      const s1 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const p1 = (s1.progress as Record<string, unknown>).completed as number;

      expect(p1).toBeGreaterThan(p0);
    });
  });

  describe('step add / remove / move', () => {
    it('adds a new step and it appears in status', async () => {
      const planId = uniquePlanCode('step-add');
      await buildPlanToExecuting(ctx.client, planId);

      const status0 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const totalBefore = (status0.progress as Record<string, unknown>).total as number;

      await callTool(ctx.client, 'riotplan_step', {
        planId, action: 'add', title: 'New Integration Step',
        after: 2,
      });

      const status1 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const totalAfter = (status1.progress as Record<string, unknown>).total as number;
      expect(totalAfter).toBeGreaterThan(totalBefore);
    });

    it('removes a step and total decreases', async () => {
      const planId = uniquePlanCode('step-remove');
      await buildPlanToExecuting(ctx.client, planId);

      // Add a step to remove
      await callTool(ctx.client, 'riotplan_step', {
        planId, action: 'add', title: 'Temporary Step', after: 3,
      });

      const status0 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const totalBefore = (status0.progress as Record<string, unknown>).total as number;

      // Remove the last step (number 4 now)
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'remove', step: 4 });

      const status1 = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      const totalAfter = (status1.progress as Record<string, unknown>).total as number;
      expect(totalAfter).toBe(totalBefore - 1);
    });

    it('moves a step — plan remains in executing stage', async () => {
      const planId = uniquePlanCode('step-move');
      await buildPlanToExecuting(ctx.client, planId);

      // Move step 3 before step 1
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'move', from: 3, to: 1 });

      // Verify the plan stage via read_context (riotplan_status shows operational status,
      // not lifecycle stage)
      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(context.stage).toBe('executing');
    });
  });

  describe('step reflect', () => {
    it('adds a reflection after completing step 1', async () => {
      const planId = uniquePlanCode('step-reflect');
      await buildPlanToExecuting(ctx.client, planId);

      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 1 });

      const result = await callTool(ctx.client, 'riotplan_step_reflect', {
        planId, step: 1,
        reflection: 'Step 1 went smoothly. The setup was straightforward. Next step should focus on the core logic.',
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
    });

    it('adds reflection with honest assessment of what was incomplete', async () => {
      const planId = uniquePlanCode('step-reflect-2');
      await buildPlanToExecuting(ctx.client, planId);

      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 1 });

      const result = await callTool(ctx.client, 'riotplan_step_reflect', {
        planId, step: 1,
        reflection: 'The setup was done but the config file still needs manual editing. NOTE: Auto-config is NOT complete — must be done in Step 2.',
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
    });

    it('adds reflections for multiple completed steps', async () => {
      const planId = uniquePlanCode('step-reflect-multi');
      await buildPlanToExecuting(ctx.client, planId);

      for (const step of [1, 2, 3]) {
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step });
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step });
        await callTool(ctx.client, 'riotplan_step_reflect', {
          planId, step,
          reflection: `Step ${step} complete. Reflection for step ${step}.`,
        });
      }

      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      expect((status.progress as Record<string, unknown>).completed).toBe(3);
    });
  });

  describe('multi-plan parallel execution', () => {
    it('two plans execute independently without cross-contamination', async () => {
      const planA = uniquePlanCode('parallel-a');
      const planB = uniquePlanCode('parallel-b');

      await Promise.all([
        buildPlanToExecuting(ctx.client, planA),
        buildPlanToExecuting(ctx.client, planB),
      ]);

      // Complete step 1 in plan A
      await callTool(ctx.client, 'riotplan_step', { planId: planA, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId: planA, action: 'complete', step: 1 });

      // Plan B should still be at 0 completed
      const statusB = await callTool(ctx.client, 'riotplan_status', { planId: planB }) as Record<string, unknown>;
      const completedB = (statusB.progress as Record<string, unknown>).completed as number;
      expect(completedB).toBe(0);

      // Plan A should be at 1 completed
      const statusA = await callTool(ctx.client, 'riotplan_status', { planId: planA }) as Record<string, unknown>;
      const completedA = (statusA.progress as Record<string, unknown>).completed as number;
      expect(completedA).toBe(1);
    });
  });
});
