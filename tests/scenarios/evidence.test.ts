import { describe, it, expect, beforeAll } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Evidence CRUD', () => {
  const ctx = useTestContext();
  let planId: string;
  let evidenceId1: string;
  let evidenceId2: string;
  let evidenceId3: string;

  beforeAll(async () => {
    planId = uniquePlanCode('evidence');
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Evidence CRUD test plan',
    });
  });

  it('adds evidence with all fields', async () => {
    const result = await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add',
      planId,
      title: 'Performance Benchmarks',
      summary: 'Benchmarks from similar projects showing sub-100ms response times.',
      content: 'Detailed analysis: Project X achieved 80ms p99 with the caching approach.',
      sources: ['https://example.com/benchmarks', 'internal-report-2024'],
      tags: ['performance', 'benchmarks'],
      referenceSources: [{ type: 'url', value: 'https://example.com/benchmarks', label: 'Benchmark Report' }],
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
    const evidenceIdValue = result.evidenceId ?? (result.evidence as Record<string, unknown>)?.evidenceId;
    expect(evidenceIdValue, 'add should return an evidenceId').toBeDefined();
    evidenceId1 = evidenceIdValue as string;
  });

  it('adds evidence with only required fields', async () => {
    const result = await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add',
      planId,
      title: 'Minimal Evidence',
      summary: 'A minimal evidence entry.',
      content: 'Just the bare minimum content.',
    }) as Record<string, unknown>;

    const evidenceIdValue = result.evidenceId ?? (result.evidence as Record<string, unknown>)?.evidenceId;
    expect(evidenceIdValue).toBeDefined();
    evidenceId2 = evidenceIdValue as string;
  });

  it('adds a third evidence item with tags', async () => {
    const result = await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add',
      planId,
      title: 'User Research Findings',
      summary: 'Key findings from user interviews.',
      content: 'Users prefer the incremental approach over big-bang changes.',
      tags: ['ux', 'research'],
    }) as Record<string, unknown>;

    const evidenceIdValue = result.evidenceId ?? (result.evidence as Record<string, unknown>)?.evidenceId;
    expect(evidenceIdValue).toBeDefined();
    evidenceId3 = evidenceIdValue as string;
  });

  it('reads context and verifies all three evidence items appear', async () => {
    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.count).toBeGreaterThanOrEqual(3);
  });

  it('edits evidence title and summary', async () => {
    await callTool(ctx.client, 'riotplan_evidence', {
      action: 'edit',
      planId,
      evidenceRef: { evidenceId: evidenceId1 },
      patch: {
        title: 'Performance Benchmarks (Updated)',
        summary: 'Updated summary with new findings.',
      },
    });

    // Verify the edit took effect via read_context
    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const contextText = JSON.stringify(context.evidence);
    expect(contextText).toContain('Updated');
  });

  it('edits evidence content', async () => {
    await callTool(ctx.client, 'riotplan_evidence', {
      action: 'edit',
      planId,
      evidenceRef: { evidenceId: evidenceId2 },
      patch: { content: 'Updated content: more detailed analysis added.' },
    });
  });

  it('deletes one evidence item and verifies others remain', async () => {
    await callTool(ctx.client, 'riotplan_evidence', {
      action: 'delete',
      planId,
      evidenceRef: { evidenceId: evidenceId3 },
      confirm: true,
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    // Should still have evidenceId1 and evidenceId2
    expect(evidence.count).toBeGreaterThanOrEqual(2);
  });

  it('verifies deleted evidence no longer appears', async () => {
    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidenceText = JSON.stringify(context.evidence);
    expect(evidenceText).not.toContain('User Research Findings');
  });

  it('adds evidence after deletion — not a stuck state', async () => {
    const result = await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add',
      planId,
      title: 'Post-delete Addition',
      summary: 'Added after a delete to verify no stuck state.',
      content: 'System should allow new evidence after deletion.',
    }) as Record<string, unknown>;

    const evidenceIdValue = result.evidenceId ?? (result.evidence as Record<string, unknown>)?.evidenceId;
    expect(evidenceIdValue).toBeDefined();
  });

  it('verifies evidence survives stage transition to shaping', async () => {
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.count).toBeGreaterThanOrEqual(2);
    expect(context.stage).toBe('shaping');
  });

  it('adds more evidence during shaping and verifies both eras coexist', async () => {
    const result = await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add',
      planId,
      title: 'Shaping-era Evidence',
      summary: 'Evidence added during the shaping stage.',
      content: 'Approach A has better test coverage than Approach B.',
    }) as Record<string, unknown>;

    const evidenceIdValue = result.evidenceId ?? (result.evidence as Record<string, unknown>)?.evidenceId;
    expect(evidenceIdValue).toBeDefined();

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    // Should have both pre-shaping and shaping-era evidence
    expect(evidence.count).toBeGreaterThanOrEqual(3);
  });
});
