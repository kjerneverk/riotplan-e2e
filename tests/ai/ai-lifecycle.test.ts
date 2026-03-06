/**
 * AI test tier — exercises riotplan_build with the real caller-side protocol.
 *
 * These tests do NOT call an LLM directly. Instead, they verify that:
 * 1. `riotplan_build` returns valid generation instructions that an LLM caller could act on
 * 2. The prompts contain the expected content (description, approach, constraints, evidence)
 * 3. The schema for caller-side writes is present
 *
 * To run: npm run test:ai
 * These tests are excluded from the default `npm test` run.
 *
 * @ai-tier
 */
import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('AI tier: riotplan_build generation instructions', { timeout: 120_000 }, () => {
  const ctx = useTestContext();

  it('build instructions contain a non-empty systemPrompt', async () => {
    const planId = uniquePlanCode('ai-system');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI system prompt test' });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Approach A', description: 'Primary approach.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Approach A', reason: 'Only option',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    const systemPrompt = instructions.systemPrompt as string;

    expect(systemPrompt.length).toBeGreaterThan(100);
    expect(systemPrompt).toMatch(/plan|step|execution/i);
  });

  it('build instructions userPrompt contains the plan description', async () => {
    const planId = uniquePlanCode('ai-desc');
    const uniquePhrase = `UNIQUE_PHRASE_${Date.now()}`;
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId,
      description: `AI desc test: ${uniquePhrase}`,
    });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Test Approach', description: 'For AI test.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Test Approach', reason: 'Testing',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    expect(instructions.userPrompt).toContain(uniquePhrase);
  });

  it('build instructions include constraints in userPrompt', async () => {
    const planId = uniquePlanCode('ai-constraints');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI constraints test' });
    await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Must use TypeScript' });
    await callTool(ctx.client, 'riotplan_idea', { action: 'add_constraint', planId, constraint: 'Must support Node.js 24+' });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'TS Approach', description: 'TypeScript-first.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'TS Approach', reason: 'Matches constraints',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    const prompt = instructions.userPrompt as string;
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Node.js 24');
  });

  it('build instructions include evidence in userPrompt when evidence was added', async () => {
    const planId = uniquePlanCode('ai-evidence');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI evidence test' });
    await callTool(ctx.client, 'riotplan_evidence', {
      action: 'add', planId,
      title: 'Performance Study',
      summary: 'Benchmark results showing 10x improvement.',
      content: 'Detailed: the cache-first approach achieves sub-10ms latency.',
    });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Cache Approach', description: 'Cache-first design.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Cache Approach', reason: 'Evidence supports it',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    const prompt = instructions.userPrompt as string;
    // Evidence should appear in the prompt
    expect(prompt).toContain('Performance Study');
  });

  it('build instructions include selected approach details', async () => {
    const planId = uniquePlanCode('ai-approach');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI approach test' });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId,
      name: 'Event-Driven Architecture',
      description: 'Decouple using async events for scalability.',
      tradeoffs: ['Pro: Loose coupling', 'Con: Eventual consistency'],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Event-Driven Architecture',
      reason: 'Best fits scalability requirements.',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    const prompt = instructions.userPrompt as string;
    expect(prompt).toContain('Event-Driven');
    expect(prompt).toContain('scalability');
  });

  it('build returns a jsonSchema or writeProtocol for caller validation', async () => {
    const planId = uniquePlanCode('ai-schema');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI schema test' });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Schema Approach', description: 'For schema test.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Schema Approach', reason: 'Testing schema',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    expect(result.generationInstructions).toBeDefined();

    // The instructions should tell a caller LLM how to structure its output
    const instructions = result.generationInstructions as Record<string, unknown>;
    const prompt = instructions.userPrompt as string;
    // Should reference the write protocol (validate, write artifacts, write steps)
    expect(prompt).toMatch(/validate|write|artifact|step/i);
  });

  it('build returns the planId in the result for traceability', async () => {
    const planId = uniquePlanCode('ai-traceable');
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI traceable test' });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Traceable Approach', description: 'Test.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Traceable Approach', reason: 'Testing',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    // planId should be in the result for traceability
    const text = JSON.stringify(result);
    expect(text).toContain(planId);
  });

  it('build with existing notes includes them in the generation context', async () => {
    const planId = uniquePlanCode('ai-notes');
    const noteContent = `IMPORTANT_NOTE_${Date.now()}`;
    await callTool(ctx.client, 'riotplan_idea', { action: 'create', code: planId, description: 'AI notes test' });
    await callTool(ctx.client, 'riotplan_idea', { action: 'add_note', planId, note: noteContent });
    await callTool(ctx.client, 'riotplan_shaping', { action: 'start', planId });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach', planId, name: 'Notes Approach', description: 'Test.', tradeoffs: [],
    });
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select', planId, approach: 'Notes Approach', reason: 'Testing',
    });

    const result = await callTool(ctx.client, 'riotplan_build', { planId }) as Record<string, unknown>;
    const instructions = result.generationInstructions as Record<string, unknown>;
    expect(instructions.userPrompt).toContain(noteContent);
  });
});
