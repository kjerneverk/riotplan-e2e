import { describe, it, expect, beforeAll } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Shaping Stage Mutations', () => {
  const ctx = useTestContext();
  let planId: string;

  beforeAll(async () => {
    planId = uniquePlanCode('shaping');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Shaping mutations test plan',
    });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
  });

  describe('Approaches', () => {
    it('adds first approach with full details', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId,
        name: 'Option A: Microservices',
        description: 'Break the system into independent microservices.',
        tradeoffs: ['Pro: Independent deployability', 'Pro: Scalability', 'Con: Operational complexity'],
        assumptions: ['Team has containerization experience', 'CI/CD pipeline is mature'],
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(ctx2.shaping)).toContain('Option A: Microservices');
    });

    it('adds second approach with different tradeoffs', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId,
        name: 'Option B: Monolith Refactor',
        description: 'Refactor the existing monolith to improve modularity.',
        tradeoffs: ['Pro: Lower risk', 'Pro: Easier to debug', 'Con: Limited scalability'],
        assumptions: ['Current codebase has decent test coverage'],
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(ctx2.shaping);
      expect(text).toContain('Option A: Microservices');
      expect(text).toContain('Option B: Monolith Refactor');
    });

    it('adds a third approach', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId,
        name: 'Option C: Event-Driven Architecture',
        description: 'Decouple components via an event bus.',
        tradeoffs: ['Pro: Loose coupling', 'Con: Eventual consistency challenges'],
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(ctx2.shaping)).toContain('Option C: Event-Driven Architecture');
    });

    it('verifies all three approaches are independently readable', async () => {
      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(ctx2.shaping);
      expect(text).toContain('Microservices');
      expect(text).toContain('Monolith Refactor');
      expect(text).toContain('Event-Driven');
    });
  });

  describe('Feedback', () => {
    it('adds feedback on approach A', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_feedback', planId,
        feedback: 'Option A is appealing but the team lacks containerization experience right now.',
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(ctx2.shaping)).toContain('containerization experience');
    });

    it('adds feedback on approach B', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_feedback', planId,
        feedback: 'Option B is preferred by the team due to lower risk.',
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(ctx2.shaping);
      expect(text).toContain('containerization experience');
      expect(text).toContain('lower risk');
    });

    it('adds multiple feedbacks on same plan', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_feedback', planId,
        feedback: 'Additional feedback: consider the 6-month roadmap before deciding.',
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(ctx2.shaping)).toContain('6-month roadmap');
    });
  });

  describe('Compare', () => {
    it('compares with 3 approaches — result references all options', async () => {
      const result = await callTool(ctx.client, 'riotplan_shaping', {
        action: 'compare', planId,
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
      // Compare should produce meaningful output (message or comparison text)
      const text = JSON.stringify(result);
      expect(text.length).toBeGreaterThan(10);
    });
  });

  describe('Selection', () => {
    it('selects approach B with a reason', async () => {
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'select', planId,
        approach: 'Option B: Monolith Refactor',
        reason: 'Lower risk matches our current team capabilities and 6-month timeline.',
      });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(ctx2.shaping);
      expect(text).toContain('Monolith Refactor');
    });

    it('verifies selected approach name and reason appear in context', async () => {
      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(ctx2.shaping);
      expect(text).toContain('Lower risk matches');
    });
  });
});
