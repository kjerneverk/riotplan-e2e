# Regression Tests

This directory contains regression tests for user-reported issues in RiotPlan.

## Pattern

Each regression test file covers one or more related issues reported by users or found
during development. Regression tests prevent the same bug from being reintroduced.

## Naming Convention

```
{issue-number}-{short-description}.test.ts
```

Examples:
- `42-evidence-delete-requires-confirm.test.ts`
- `67-step-complete-before-start.test.ts`
- `99-unicode-in-plan-code.test.ts`

If the issue doesn't have a number (e.g., found internally), use:
```
internal-{short-description}.test.ts
```

## File Structure

Each regression test should:
1. Reference the issue or ticket at the top of the file
2. Describe the exact scenario that was broken
3. Have at least one `it` block that fails without the fix
4. Use `useTestContext()` and `callTool()` like scenario tests

See `_template.test.ts` for a starting template.

## Running Regression Tests

Regression tests run as part of the default `npm test` suite (both HTTP and STDIO).
They are included in the `local-http` and `stdio` project configurations in `vitest.config.ts`.

```bash
# Run all scenario + regression tests
npm test

# Run only regression tests (HTTP)
npx vitest run --project local-http --reporter=verbose tests/regressions/

# Run only regression tests (STDIO)
npx vitest run --project stdio --reporter=verbose tests/regressions/
```

## Adding a New Regression Test

1. Copy `_template.test.ts` to `{issue}-{description}.test.ts`
2. Fill in the issue reference, description, and test steps
3. Run the test against a broken build to confirm it fails
4. Apply the fix to RiotPlan
5. Confirm the regression test passes

## Current Regressions

| File | Issue | Description |
|------|-------|-------------|
| `internal-kill-sqlite-enotdir.test.ts` | Internal | `riotplan_idea kill` fails on SQLite storage with ENOTDIR |
| `internal-invalid-json-returns-500.test.ts` | Internal | HTTP server returns 500 instead of 400 for invalid JSON bodies |
