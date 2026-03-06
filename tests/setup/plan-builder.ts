/**
 * Shared helper for building a plan through the full caller-side protocol.
 * Used by tests that need a plan in "built" or "executing" stage without
 * going through the full lifecycle test.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool } from '../../src/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '..', 'fixtures', 'lifecycle');

function fixture(path: string): string {
  return readFileSync(join(fixturesDir, path), 'utf-8');
}

/**
 * Builds a plan through idea → shaping → built stages.
 * Uses minimal content (no evidence) to avoid evidence grounding requirements.
 * Returns the planId.
 */
export async function buildPlanToBuilt(
  client: Client,
  planId: string,
  approachName = 'Approach A: Test Approach'
): Promise<void> {
  // Idea stage
  await callTool(client, 'riotplan_idea', {
    action: 'create',
    code: planId,
    description: `Test plan: ${planId}`,
    ideaContent: 'Test plan for integration testing.',
  });

  await callTool(client, 'riotplan_idea', {
    action: 'add_constraint',
    planId,
    constraint: 'Must complete in time',
  });

  // Shaping stage
  await callTool(client, 'riotplan_shaping', { action: 'start', planId });

  await callTool(client, 'riotplan_shaping', {
    action: 'add_approach',
    planId,
    name: approachName,
    description: 'Standard test approach.',
    tradeoffs: ['Pro: Simple', 'Con: Not fancy'],
  });

  await callTool(client, 'riotplan_shaping', {
    action: 'select',
    planId,
    approach: approachName,
    reason: 'Only option for test purposes.',
  });

  // Build stage (caller-side protocol)
  await callTool(client, 'riotplan_build', { planId, steps: 3 });

  const validateResult = await callTool(client, 'riotplan_build_validate_plan', {
    planId,
    generatedPlan: {
      summary: fixture('summary.md'),
      approach: approachName,
      successCriteria: 'All steps complete',
      analysis: {
        constraintAnalysis: [
          {
            constraint: 'Must complete in time',
            understanding: 'Timebox',
            plannedApproach: 'Steps fit in one sprint',
          },
        ],
        approachAnalysis: {
          selectedApproach: approachName,
          commitments: 'Use the test approach',
          implementationStrategy: 'Steps 1-3',
        },
        risks: [],
      },
      steps: [
        {
          number: 1, title: 'Setup', objective: 'Init', background: 'Start',
          tasks: [{ id: '1.1', description: 'Do setup' }],
          acceptanceCriteria: ['Setup done'], testing: 'Check', filesChanged: [], notes: '',
          provenance: { constraintsAddressed: ['Must complete in time'], evidenceUsed: [], rationale: 'Foundation' },
        },
        {
          number: 2, title: 'Implement', objective: 'Build', background: 'Work',
          tasks: [{ id: '2.1', description: 'Do work' }],
          acceptanceCriteria: ['Work done'], testing: 'Run tests', filesChanged: [], notes: '',
          provenance: { constraintsAddressed: [], evidenceUsed: [], rationale: 'Core work' },
        },
        {
          number: 3, title: 'Validate', objective: 'Verify', background: 'Check',
          tasks: [{ id: '3.1', description: 'Verify' }],
          acceptanceCriteria: ['All good'], testing: 'CI', filesChanged: [], notes: '',
          provenance: { constraintsAddressed: [], evidenceUsed: [], rationale: 'Validation' },
        },
      ],
    },
  }) as Record<string, unknown>;

  const validationStamp = validateResult.validationStamp as string;

  await callTool(client, 'riotplan_build_write_artifact', {
    planId, type: 'summary', validationStamp, content: fixture('summary.md'),
  });
  await callTool(client, 'riotplan_build_write_artifact', {
    planId, type: 'execution_plan', validationStamp, content: fixture('execution-plan.md'),
  });
  await callTool(client, 'riotplan_build_write_artifact', {
    planId, type: 'status', validationStamp, content: `# Status\n\n**Stage**: built\n**Progress**: 0/3`,
  });
  await callTool(client, 'riotplan_build_write_step', {
    planId, step: 1, title: 'Setup', validationStamp, clearExisting: true, content: fixture('steps/01-step.md'),
  });
  await callTool(client, 'riotplan_build_write_step', {
    planId, step: 2, title: 'Implement', validationStamp, content: fixture('steps/02-step.md'),
  });
  await callTool(client, 'riotplan_build_write_step', {
    planId, step: 3, title: 'Validate', validationStamp, content: fixture('steps/03-step.md'),
  });
  await callTool(client, 'riotplan_build_write_artifact', {
    planId, type: 'provenance', validationStamp, content: '# Provenance\n\nTest fixtures.',
  });

  await callTool(client, 'riotplan_transition', {
    planId, stage: 'built', reason: 'Test plan built',
  });
}

/**
 * Builds a plan all the way to "executing" stage.
 */
export async function buildPlanToExecuting(client: Client, planId: string): Promise<void> {
  await buildPlanToBuilt(client, planId);
  await callTool(client, 'riotplan_transition', {
    planId, stage: 'executing', reason: 'Begin execution for testing',
  });
}
