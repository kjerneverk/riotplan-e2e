import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';
import { expectStage, expectProgress } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '..', 'fixtures', 'lifecycle');

function fixture(path: string): string {
  return readFileSync(join(fixturesDir, path), 'utf-8');
}

// Module-level state shared across sequential tests (not globalThis - Vitest workers)
let _validationStamp: string | null = null;

describe('Full Plan Lifecycle', () => {
  const ctx = useTestContext();
  let planId: string;

  beforeAll(() => {
    planId = uniquePlanCode('lifecycle');
    _validationStamp = null;
  });

  // ─── IDEA STAGE ─────────────────────────────────────────────────────────────

  it('creates an idea with description and content', async () => {
    const result = await callTool(ctx.client, 'riotplan_idea', {
      action: 'create',
      code: planId,
      description: 'E2E lifecycle test plan',
      ideaContent: 'This plan tests the complete RiotPlan lifecycle end-to-end.',
    }) as Record<string, unknown>;

    expect(result.planId).toBe(planId);
    await expectStage(ctx.client, planId, 'idea');
  });

  it('adds a note and verifies it appears in context', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_note',
      planId,
      note: 'This is the first test note',
    });

    const ctx2 = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(ctx2.idea);
    expect(ideaText).toContain('first test note');
  });

  it('adds a second note and verifies both notes appear', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_note',
      planId,
      note: 'This is the second test note',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(context.idea);
    expect(ideaText).toContain('first test note');
    expect(ideaText).toContain('second test note');
  });

  it('adds a constraint and verifies it appears', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_constraint',
      planId,
      constraint: 'Must complete within one sprint',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(context.idea);
    expect(ideaText).toContain('Must complete within one sprint');
  });

  it('adds a second constraint and verifies both constraints appear', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_constraint',
      planId,
      constraint: 'No breaking changes to public API',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(context.idea);
    expect(ideaText).toContain('Must complete within one sprint');
    expect(ideaText).toContain('No breaking changes to public API');
  });

  it('adds a question and verifies it appears', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_question',
      planId,
      question: 'What is the expected performance budget?',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(context.idea);
    expect(ideaText).toContain('expected performance budget');
  });

  it('adds evidence and verifies it appears in context', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_evidence',
      planId,
      description: 'Performance benchmarks from similar projects',
      source: 'internal-benchmarks-2024',
      content: 'Similar projects achieved sub-100ms response times with this approach.',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.count).toBeGreaterThanOrEqual(1);
  });

  it('adds a second evidence item with minimal fields', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_evidence',
      planId,
      description: 'Minimal evidence entry',
      source: 'quick-note',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.count).toBeGreaterThanOrEqual(2);
  });

  it('adds a narrative entry (stored in history, not idea content)', async () => {
    // Narratives are logged to timeline, not IDEA.md - verify the call succeeds
    const result = await callTool(ctx.client, 'riotplan_idea', {
      action: 'add_narrative',
      planId,
      content: 'The team discussed this approach in our planning session.',
      context: 'planning-meeting',
      speaker: 'team',
    }) as Record<string, unknown>;

    // Narrative call should succeed
    expect(result).toBeDefined();

    // Verify it appears in history events
    const history = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
    const historyText = JSON.stringify(history);
    expect(historyText).toMatch(/narrative/i);
  });

  it('updates idea content with set_content and verifies change', async () => {
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'set_content',
      planId,
      content: 'Updated idea content: This plan has been refined after initial exploration.',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const ideaText = JSON.stringify(context.idea);
    expect(ideaText).toContain('refined after initial exploration');
  });

  it('verifies read_context returns complete idea state', async () => {
    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    expect(context.planId).toBe(planId);
    expect(context.stage).toBe('idea');
    expect(context.idea).toBeDefined();
    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.count).toBeGreaterThanOrEqual(2);
  });

  // ─── SHAPING STAGE ──────────────────────────────────────────────────────────

  it('transitions to shaping stage', async () => {
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'start',
      planId,
    });

    await expectStage(ctx.client, planId, 'shaping');
  });

  it('adds first approach with full details', async () => {
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach',
      planId,
      name: 'Approach A: Incremental Migration',
      description: 'Migrate components one at a time with feature flags.',
      tradeoffs: ['Pro: Low risk', 'Pro: Rollback friendly', 'Con: Slower delivery'],
      assumptions: ['Feature flags infrastructure is available'],
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    expect(JSON.stringify(context.shaping)).toContain('Approach A');
  });

  it('adds second approach', async () => {
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_approach',
      planId,
      name: 'Approach B: Big Bang Replacement',
      description: 'Replace the entire system in one release.',
      tradeoffs: ['Pro: Clean break', 'Con: High risk', 'Con: No rollback'],
      assumptions: ['Full test coverage exists'],
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    const shapingText = JSON.stringify(context.shaping);
    expect(shapingText).toContain('Approach A');
    expect(shapingText).toContain('Approach B');
  });

  it('adds feedback on first approach', async () => {
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'add_feedback',
      planId,
      feedback: 'Approach A is preferred by the team for its lower risk profile.',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    expect(JSON.stringify(context.shaping)).toContain('lower risk profile');
  });

  it('compares approaches', async () => {
    const result = await callTool(ctx.client, 'riotplan_shaping', {
      action: 'compare',
      planId,
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
  });

  it('selects an approach with reason', async () => {
    await callTool(ctx.client, 'riotplan_shaping', {
      action: 'select',
      planId,
      approach: 'Approach A: Incremental Migration',
      reason: 'Lower risk and team preference make this the right choice.',
    });

    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    expect(JSON.stringify(context.shaping)).toContain('Incremental Migration');
  });

  it('verifies read_context includes idea + shaping content', async () => {
    const context = await callTool(ctx.client, 'riotplan_read_context', { planId }) as Record<string, unknown>;
    expect(context.stage).toBe('shaping');
    expect(context.idea).toBeDefined();
    expect(context.shaping).toBeDefined();
  });

  // ─── BUILD STAGE (caller-side protocol with fixtures) ───────────────────────

  it('calls riotplan_build and receives generation instructions', async () => {
    const result = await callTool(ctx.client, 'riotplan_build', {
      planId,
      steps: 3,
    }) as Record<string, unknown>;

    expect(result.generationInstructions).toBeDefined();
    const instructions = result.generationInstructions as Record<string, unknown>;
    expect(instructions.systemPrompt).toBeDefined();
    expect(instructions.userPrompt).toBeDefined();
    // userPrompt should reference our constraints
    expect(instructions.userPrompt as string).toContain('Must complete within one sprint');
  });

  it('validates a pre-generated plan and receives a validationStamp', async () => {
    const preGeneratedPlan = {
      summary: fixture('summary.md'),
      approach: 'Approach A: Incremental Migration',
      successCriteria: 'All 3 steps complete',
      analysis: {
        constraintAnalysis: [
          {
            constraint: 'Must complete within one sprint',
            understanding: 'Timebox the work to one iteration',
            plannedApproach: 'Step 1 through 3 fit within a single sprint',
          },
        ],
        approachAnalysis: {
          selectedApproach: 'Approach A: Incremental Migration',
          commitments: 'Migrate incrementally using feature flags',
          implementationStrategy: 'Steps 1-3 implement the incremental migration approach',
        },
        risks: ['Feature flag infrastructure may not be ready'],
      },
      steps: [
        {
          number: 1, title: 'Setup', objective: 'Initialize', background: 'Start here',
          tasks: [{ id: '1.1', description: 'Create dir' }],
          acceptanceCriteria: ['Dir exists'], testing: 'Check dir', filesChanged: [], notes: '',
          provenance: {
            constraintsAddressed: ['Must complete within one sprint'],
            evidenceUsed: ['performance-benchmarks-from-similar-projects.md', 'minimal-evidence-entry.md'],
            rationale: 'Foundation informed by performance benchmarks evidence',
          },
        },
        {
          number: 2, title: 'Implement', objective: 'Build', background: 'Core work',
          tasks: [{ id: '2.1', description: 'Write code' }],
          acceptanceCriteria: ['Tests pass'], testing: 'Run tests', filesChanged: [], notes: '',
          provenance: { constraintsAddressed: [], evidenceUsed: [], rationale: 'Implementation' },
        },
        {
          number: 3, title: 'Validate', objective: 'Verify', background: 'Final checks',
          tasks: [{ id: '3.1', description: 'Run all tests' }],
          acceptanceCriteria: ['All green'], testing: 'CI passes', filesChanged: [], notes: '',
          provenance: { constraintsAddressed: [], evidenceUsed: [], rationale: 'Validation' },
        },
      ],
    };

    const result = await callTool(ctx.client, 'riotplan_build_validate_plan', {
      planId,
      generatedPlan: preGeneratedPlan,
    }) as Record<string, unknown>;

    expect(result.validationStamp).toBeDefined();
    _validationStamp = result.validationStamp as string;
  });

  it('writes all build artifacts using the validation stamp', async () => {
    const validationStamp = _validationStamp;
    expect(validationStamp, 'validationStamp must exist from previous test').toBeTruthy();

    await callTool(ctx.client, 'riotplan_build_write_artifact', {
      planId, type: 'summary', validationStamp, content: fixture('summary.md'),
    });

    await callTool(ctx.client, 'riotplan_build_write_artifact', {
      planId, type: 'execution_plan', validationStamp, content: fixture('execution-plan.md'),
    });

    await callTool(ctx.client, 'riotplan_build_write_artifact', {
      planId, type: 'status', validationStamp,
      content: `# Status\n\n**Stage**: built\n**Progress**: 0/3 steps`,
    });

    await callTool(ctx.client, 'riotplan_build_write_step', {
      planId, step: 1, title: 'Setup', validationStamp, clearExisting: true,
      content: fixture('steps/01-step.md'),
    });

    await callTool(ctx.client, 'riotplan_build_write_step', {
      planId, step: 2, title: 'Implement', validationStamp,
      content: fixture('steps/02-step.md'),
    });

    await callTool(ctx.client, 'riotplan_build_write_step', {
      planId, step: 3, title: 'Validate', validationStamp,
      content: fixture('steps/03-step.md'),
    });

    await callTool(ctx.client, 'riotplan_build_write_artifact', {
      planId, type: 'provenance', validationStamp,
      content: '# Provenance\n\nGenerated from pre-canned fixtures for e2e testing.',
    });
  });

  it('transitions to built stage', async () => {
    await callTool(ctx.client, 'riotplan_transition', {
      planId,
      stage: 'built',
      reason: 'Artifacts written via caller-side build protocol',
    });

    await expectStage(ctx.client, planId, 'built');
    await expectProgress(ctx.client, planId, 0, 3);
  });

  // ─── EXECUTION STAGE ────────────────────────────────────────────────────────

  it('transitions to executing', async () => {
    await callTool(ctx.client, 'riotplan_transition', {
      planId,
      stage: 'executing',
      reason: 'Beginning step execution',
    });

    await expectStage(ctx.client, planId, 'executing');
  });

  it('starts step 1 and verifies in-progress state', async () => {
    await callTool(ctx.client, 'riotplan_step', {
      planId,
      action: 'start',
      step: 1,
    });

    await expectProgress(ctx.client, planId, 0, 3);
  });

  it('completes step 1 and verifies progress 1/3', async () => {
    await callTool(ctx.client, 'riotplan_step', {
      planId,
      action: 'complete',
      step: 1,
    });

    await expectProgress(ctx.client, planId, 1, 3);
  });

  it('starts and completes step 2, verifies progress 2/3', async () => {
    await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 2 });
    await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 2 });

    await expectProgress(ctx.client, planId, 2, 3);
  });

  it('starts and completes step 3, verifies progress 3/3', async () => {
    await callTool(ctx.client, 'riotplan_step', { planId, action: 'start', step: 3 });
    await callTool(ctx.client, 'riotplan_step', { planId, action: 'complete', step: 3 });

    await expectProgress(ctx.client, planId, 3, 3);
  });

  // ─── COMPLETION ─────────────────────────────────────────────────────────────

  it('verifies history contains all lifecycle events', async () => {
    const result = await callTool(ctx.client, 'riotplan_history_show', { planId }) as Record<string, unknown>;
    expect(result).toBeDefined();
    const historyText = JSON.stringify(result);
    // Should have key events from the lifecycle
    expect(historyText).toContain('idea');
    expect(historyText).toContain('shaping');
  });

  it('verifies final plan state is fully complete', async () => {
    const status = await callTool(ctx.client, 'riotplan_status', { planId }) as Record<string, unknown>;
    const progress = status.progress as Record<string, unknown>;
    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(3);
    expect(progress.percentage).toBe(100);
  });
});
