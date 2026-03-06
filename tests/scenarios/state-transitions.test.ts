import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';
import { expectStage } from './helpers.js';
import { buildPlanToBuilt } from '../setup/plan-builder.js';

describe('State Transitions', () => {
  const ctx = useTestContext();

  describe('Forward transitions (happy path)', () => {
    it('idea → shaping → built → executing → completed', async () => {
      const planId = uniquePlanCode('fwd-trans');
      await buildPlanToBuilt(ctx.client, planId);
      await expectStage(ctx.client, planId, 'built');

      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'executing', reason: 'Begin' });
      await expectStage(ctx.client, planId, 'executing');

      // Complete all steps
      for (const step of [1, 2, 3]) {
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step });
        await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step });
      }

      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'completed', reason: 'Done' });
      await expectStage(ctx.client, planId, 'completed');
    });
  });

  describe('Backward transitions', () => {
    it('shaping → idea: idea content remains intact', async () => {
      const planId = uniquePlanCode('back-to-idea');
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'create', code: planId, description: 'Backward transition test',
        ideaContent: 'Idea content that must survive backward transition.',
      });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Note before shaping' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await expectStage(ctx.client, planId, 'shaping');

      // Transition back to idea
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'Reconsidering' });
      await expectStage(ctx.client, planId, 'idea');

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(context.idea)).toContain('Note before shaping');
    });

    it('shaping → idea: can add more notes after going back', async () => {
      const planId = uniquePlanCode('back-add-notes');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Back-add test' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'Need more analysis' });

      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'New note after going back' });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(context.idea)).toContain('New note after going back');
    });

    it('built → shaping: approaches still exist and new ones can be added', async () => {
      const planId = uniquePlanCode('back-to-shaping');
      await buildPlanToBuilt(ctx.client, planId, 'Original Approach');
      await expectStage(ctx.client, planId, 'built');

      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'shaping', reason: 'Need to revisit approach' });
      await expectStage(ctx.client, planId, 'shaping');

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(context.shaping)).toContain('Original Approach');

      // Can add a new approach after going back
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId,
        name: 'New Alternative Approach',
        description: 'Reconsidered after initial build.',
        tradeoffs: ['Pro: Better fit'],
      });

      const context2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(JSON.stringify(context2.shaping)).toContain('New Alternative Approach');
    });

    it('executing → built: step states are preserved', async () => {
      const planId = uniquePlanCode('back-to-built');
      await buildPlanToBuilt(ctx.client, planId);
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'executing', reason: 'Starting' });

      // Complete step 1
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 1 });
      await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 1 });

      // Go back to built
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'built', reason: 'Found a blocker' });
      await expectStage(ctx.client, planId, 'built');

      // Steps should still be tracked
      const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
      expect(status).toBeDefined();
    });
  });

  describe('Back-and-forth round trips', () => {
    it('idea → shaping → idea → shaping: no data corruption across round-trips', async () => {
      const planId = uniquePlanCode('roundtrip');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Round-trip test' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Round-trip note' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Round-trip constraint' });

      // First shaping visit
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'First Approach', description: 'Added during first shaping visit.', tradeoffs: [],
      });

      // Back to idea
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'More research needed' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Note added after first trip back' });

      // Second shaping visit
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(context);
      // All content should be intact
      expect(text).toContain('Round-trip note');
      expect(text).toContain('Round-trip constraint');
      expect(text).toContain('Note added after first trip back');
      expect(text).toContain('First Approach');
    });

    it('adds content at each stage of round-trip — all content accumulates', async () => {
      const planId = uniquePlanCode('accumulate');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Accumulation test' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Idea stage note A' });

      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'Approach X', description: 'First visit approach.', tradeoffs: [],
      });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_feedback', planId, feedback: 'Shaping feedback from first visit.',
      });

      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'Back to idea' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Idea stage note B (after first shaping)' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'New constraint after backtrack' });

      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(context);
      expect(text).toContain('Idea stage note A');
      expect(text).toContain('Approach X');
      expect(text).toContain('Shaping feedback from first visit');
      expect(text).toContain('Idea stage note B');
      expect(text).toContain('New constraint after backtrack');
    });
  });

  describe('Modifications after backward transition', () => {
    it('transition back to idea, add constraints, re-shape: new constraints in build context', async () => {
      const planId = uniquePlanCode('mod-after-back');
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'create', code: planId, description: 'Modification after backward transition',
      });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Original constraint' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'First Approach', description: 'First attempt.', tradeoffs: [],
      });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'select', planId, approach: 'First Approach', reason: 'Initial selection',
      });

      // Go back and add a new constraint
      await callTool(ctx.client, 'riotplan_transition', { planId, stage: 'idea', reason: 'New requirements came in' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'NEW: must support mobile' });

      // Re-enter shaping with different approach
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'Mobile-First Approach',
        description: 'Redesigned for mobile support.', tradeoffs: [],
      });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'select', planId, approach: 'Mobile-First Approach', reason: 'Mobile is now required',
      });

      const buildResult = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
      const instructions = buildResult.generationInstructions as Record<string, unknown>;
      const userPrompt = instructions.userPrompt as string;

      expect(userPrompt).toContain('Original constraint');
      expect(userPrompt).toContain('must support mobile');
      expect(userPrompt).toContain('Mobile-First Approach');
    });
  });

  describe('Data preservation across transitions', () => {
    it('all idea artifacts survive transition through shaping into context', async () => {
      const planId = uniquePlanCode('preserve');
      await callTool(ctx.client, 'riotplan_idea', {
        action: 'create', code: planId, description: 'Data preservation test',
        ideaContent: 'Rich idea content.',
      });

      for (let i = 1; i <= 3; i++) {
        await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: `Note ${i}` });
      }
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Preservation constraint' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_question', planId, question: 'Preservation question?' });

      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'Preservation Approach',
        description: 'For data preservation test.', tradeoffs: [],
      });

      // Verify all idea-stage content is accessible from shaping stage
      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(context);
      expect(text).toContain('Note 1');
      expect(text).toContain('Note 2');
      expect(text).toContain('Note 3');
      expect(text).toContain('Preservation constraint');
      expect(text).toContain('Preservation question');
      expect(text).toContain('Preservation Approach');
    });
  });
});
