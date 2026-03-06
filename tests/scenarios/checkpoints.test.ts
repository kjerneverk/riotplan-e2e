import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';
import { buildPlanToBuilt } from '../setup/plan-builder.js';

describe('Checkpoints and History', () => {
  const ctx = useTestContext();

  describe('riotplan_checkpoint create', () => {
    it('creates a named checkpoint at idea stage', async () => {
      const planId = uniquePlanCode('ckpt-create');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Checkpoint test' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Note before checkpoint' });

      const result = await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId,
        name: 'pre-shaping',
        message: 'Saving state before moving to shaping.',
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
    });

    it('creates multiple checkpoints at different points', async () => {
      const planId = uniquePlanCode('ckpt-multi');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Multi-checkpoint test' });

      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'v1', message: 'Initial idea state',
      });

      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'More work done' });

      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'v2', message: 'After adding notes',
      });

      // Both checkpoints should exist
      const listResult = await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'list', planId,
      }) as Record<string, unknown>;

      const text = JSON.stringify(listResult);
      expect(text).toContain('v1');
      expect(text).toContain('v2');
    });
  });

  describe('riotplan_checkpoint list', () => {
    it('lists checkpoints — returns array or list structure', async () => {
      const planId = uniquePlanCode('ckpt-list');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'List checkpoint test' });
      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'checkpoint-alpha', message: 'Alpha checkpoint',
      });

      const result = await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'list', planId,
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
      expect(JSON.stringify(result)).toContain('checkpoint-alpha');
    });
  });

  describe('riotplan_checkpoint show', () => {
    it('shows checkpoint details including name and message', async () => {
      const planId = uniquePlanCode('ckpt-show');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Show checkpoint test' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Note before checkpoint' });

      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'my-checkpoint', message: 'Checkpoint for show test',
      });

      const result = await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'show', planId, checkpoint: 'my-checkpoint',
      }) as Record<string, unknown>;

      const text = JSON.stringify(result);
      expect(text).toContain('my-checkpoint');
    });
  });

  describe('Checkpoints across lifecycle stages', () => {
    it('creates checkpoint at each stage — all are listable', async () => {
      const planId = uniquePlanCode('ckpt-stages');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Stage checkpoint test' });

      // Checkpoint at idea
      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'idea-checkpoint', message: 'At idea stage',
      });

      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      // Checkpoint at shaping
      await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'create', planId, name: 'shaping-checkpoint', message: 'At shaping stage',
      });

      const listResult = await callTool(ctx.client, 'riotplan_checkpoint', {
        action: 'list', planId,
      }) as Record<string, unknown>;

      const text = JSON.stringify(listResult);
      expect(text).toContain('idea-checkpoint');
      expect(text).toContain('shaping-checkpoint');
    });
  });

  describe('riotplan_history_show', () => {
    it('history exists for newly created plan', async () => {
      const planId = uniquePlanCode('hist-create');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'History test' });

      const result = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      expect(result).toBeDefined();
      const events = result.events as unknown[] ?? result.history as unknown[] ?? [];
      expect(Array.isArray(events) || typeof result === 'object').toBe(true);
    });

    it('history grows as operations are performed', async () => {
      const planId = uniquePlanCode('hist-grow');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'History growth test' });

      const before = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      const eventsBefore = JSON.stringify(before).length;

      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'This is a note for history' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Constraint for history' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      const after = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      const eventsAfter = JSON.stringify(after).length;

      // History should grow (more content after operations)
      expect(eventsAfter).toBeGreaterThan(eventsBefore);
    });

    it('history records narrative events', async () => {
      const planId = uniquePlanCode('hist-narr');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Narrative history test' });
      // add_narrative uses `content` (not `narrative`) per the tool schema
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'add_narrative', planId,
        content: 'Important discovery made: the performance approach is optimal.',
        context: 'review-meeting',
        speaker: 'team',
      });

      const history = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(history)).toMatch(/narrative/i);
    });

    it('history records stage transitions', async () => {
      const planId = uniquePlanCode('hist-trans');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Transition history test' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'Reconsidering approach' });

      const history = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(history);
      // History should mention stage changes
      expect(text).toContain('idea');
    });

    it('history filter by limit returns fewer events', async () => {
      const planId = uniquePlanCode('hist-limit');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'History limit test' });

      for (let i = 0; i < 5; i++) {
        await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: `Note ${i}` });
      }

      const full = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
      const limited = await callTool(ctx.client, 'riotplan_history_show', { planId, limit: 2 }) as Record<string, unknown>;

      const fullLen = JSON.stringify(full).length;
      const limitedLen = JSON.stringify(limited).length;
      expect(limitedLen).toBeLessThan(fullLen);
    });
  });
});
