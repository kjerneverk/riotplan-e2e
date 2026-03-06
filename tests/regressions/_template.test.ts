/**
 * Regression test template.
 *
 * Issue: #TODO — Brief description of the issue
 * Reference: https://github.com/kjerneverk/riotplan/issues/TODO
 *
 * What was broken:
 *   Describe the exact behavior that was wrong and when it was introduced.
 *
 * What the fix was:
 *   Describe the code change that resolved the issue.
 */
import { describe, it, expect } from 'vitest';
import { useTestContext, uniquePlanCode } from '../setup/test-context.js';
import { callTool } from '../../src/helpers.js';

describe('Regression: TODO — Brief issue description', () => {
  const ctx = useTestContext();

  it('reproduces the exact failure scenario from the bug report', async () => {
    const planId = uniquePlanCode('regr-TODO');

    // Arrange: set up the exact state that triggered the bug
    await callTool(ctx.client, 'riotplan_idea', {
      action: 'create', code: planId, description: 'Regression test: TODO',
    });

    // Act: call the operation that was failing
    // TODO: replace with the actual operation from the bug report
    const result = await callTool(ctx.client, 'riotplan_status', { planId });

    // Assert: verify the correct behavior (not the broken behavior)
    expect(result).toBeDefined();
    // TODO: add specific assertions that verify the fix
  });
});
