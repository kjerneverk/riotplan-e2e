import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Context Entity Operations', () => {
  const ctx = useTestContext();

  describe('riotplan_read_context', () => {
    it('returns full context for idea-stage plan', async () => {
      const planId = uniquePlanCode('ctx-idea');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Context read test' });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(context.stage).toBe('idea');
      expect(context.idea).toBeDefined();
      // planId, code, or title should be present in the context
      const text = JSON.stringify(context);
      expect(text).toContain(planId);
    });

    it('idea context includes notes and constraints', async () => {
      const planId = uniquePlanCode('ctx-notes');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Context notes test' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: 'Context note 1' });
      await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Context constraint 1' });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const text = JSON.stringify(context.idea);
      expect(text).toContain('Context note 1');
      expect(text).toContain('Context constraint 1');
    });

    it('shaping context includes approaches and feedback', async () => {
      const planId = uniquePlanCode('ctx-shaping');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Context shaping test' });
      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_approach', planId, name: 'Test Approach',
        description: 'Approach for context test.', tradeoffs: [],
      });
      await callTool(ctx.client, 'riotplan_shaping', {
        action: 'add_feedback', planId, feedback: 'Positive feedback for context test.',
      });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(context.stage).toBe('shaping');
      const text = JSON.stringify(context.shaping);
      expect(text).toContain('Test Approach');
      expect(text).toContain('Positive feedback for context test');
    });

    it('context includes evidence count', async () => {
      const planId = uniquePlanCode('ctx-evidence');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Context evidence test' });
      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId,
        title: 'Evidence for context', summary: 'Context evidence summary', content: 'Context evidence content.',
      });
      await callTool(ctx.client, 'riotplan_evidence', {
        action: 'add', planId,
        title: 'Evidence 2 for context', summary: 'Summary 2', content: 'Content 2.',
      });

      const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      const evidenceSection = context.evidence as Record<string, unknown>;
      expect(evidenceSection.count).toBeGreaterThanOrEqual(2);
    });

    it('stage field reflects current plan stage accurately', async () => {
      const planId = uniquePlanCode('ctx-stage');
      await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'Stage reflection test' });

      const ctx1 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(ctx1.stage).toBe('idea');

      await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

      const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
      expect(ctx2.stage).toBe('shaping');
    });
  });

  describe('riotplan_context (project entities)', () => {
    // ProjectSchema requires: id, name, type:'project', classification.context_type, routing.structure, routing.filename_options
    const makeProjectEntity = (name: string, description?: string) => ({
      name,
      description: description ?? `Integration test: ${name}`,
      type: 'project' as const,
      classification: {
        context_type: 'work' as const,
        topics: ['integration-test'],
      },
      routing: {
        structure: 'none' as const,
        filename_options: [] as string[],
      },
    });

    it('lists context entities', async () => {
      const result = await callTool(ctx.client, 'riotplan_context', {
        action: 'list', entityType: 'project',
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
    });

    it('creates a project entity with required fields', async () => {
      const result = await callTool(ctx.client, 'riotplan_context', {
        action: 'create',
        entityType: 'project',
        entity: makeProjectEntity('Integration Test Project'),
      }) as Record<string, unknown>;

      expect(result).toBeDefined();
      const entity = result.entity as Record<string, unknown>;
      expect(entity.name).toBe('Integration Test Project');
      // id should be a generated UUID
      expect(typeof entity.id).toBe('string');
    });

    it('gets a project entity by id', async () => {
      const createResult = await callTool(ctx.client, 'riotplan_context', {
        action: 'create',
        entityType: 'project',
        entity: makeProjectEntity('Get Test Project'),
      }) as Record<string, unknown>;

      const createdEntity = createResult.entity as Record<string, unknown>;
      const generatedId = createdEntity.id as string;

      const result = await callTool(ctx.client, 'riotplan_context', {
        action: 'get', entityType: 'project', id: generatedId,
      }) as Record<string, unknown>;

      const entity = result.entity as Record<string, unknown>;
      expect(entity.id).toBe(generatedId);
      expect(entity.name).toBe('Get Test Project');
    });

    it('updates a project entity name', async () => {
      const createResult = await callTool(ctx.client, 'riotplan_context', {
        action: 'create',
        entityType: 'project',
        entity: makeProjectEntity('Original Name Project'),
      }) as Record<string, unknown>;

      const generatedId = (createResult.entity as Record<string, unknown>).id as string;

      await callTool(ctx.client, 'riotplan_context', {
        action: 'update',
        entityType: 'project',
        id: generatedId,
        changes: { name: 'Updated Name Project', description: 'Updated description' },
      });

      const result = await callTool(ctx.client, 'riotplan_context', {
        action: 'get', entityType: 'project', id: generatedId,
      }) as Record<string, unknown>;

      expect((result.entity as Record<string, unknown>).name).toBe('Updated Name Project');
    });

    it('deletes a project entity', async () => {
      const createResult = await callTool(ctx.client, 'riotplan_context', {
        action: 'create',
        entityType: 'project',
        entity: makeProjectEntity('Project To Delete'),
      }) as Record<string, unknown>;

      const generatedId = (createResult.entity as Record<string, unknown>).id as string;

      await callTool(ctx.client, 'riotplan_context', {
        action: 'delete', entityType: 'project', id: generatedId,
      });

      // After deletion, get should fail or return nothing
      let errorOccurred = false;
      try {
        const result = await callTool(ctx.client, 'riotplan_context', {
          action: 'get', entityType: 'project', id: generatedId,
        }) as Record<string, unknown>;
        if (!JSON.stringify(result).includes(generatedId)) {
          errorOccurred = true;
        }
      } catch {
        errorOccurred = true;
      }
      expect(errorOccurred, 'deleted project should not be retrievable').toBe(true);
    });
  });
});
