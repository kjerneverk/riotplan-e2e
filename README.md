# riotplan-e2e

End-to-end integration tests for [RiotPlan](https://github.com/kjerneverk/riotplan) — the AI-assisted plan lifecycle system.

These tests exercise RiotPlan through its MCP interface to validate that the full system works correctly: plan creation, evidence management, lifecycle transitions, step execution, and the caller-side build protocol. They run against real, locally-built RiotPlan binaries.

## Why This Exists

Unit tests verify individual functions. These tests verify that *everything works together* — the HTTP server, MCP transport, storage layer, tool dispatch, and lifecycle state machine all behave correctly as an integrated system.

## Prerequisites

- Node.js >= 24.0.0
- The `riotplan` project checked out at `../riotplan` (or set `RIOTPLAN_DIR`)
- `npm` installed

The `@kjerneverk/riotplan` dependency uses a `file:../riotplan` reference so tests always run against the local development build.

## Running Tests

```bash
# Install dependencies
npm install

# Run core tests (HTTP + STDIO transports, scenarios + protocol)
npm test

# Run HTTP transport only
npm run test:http

# Run STDIO transport only
npm run test:stdio

# Run protocol smoke tests (HTTP wire-level)
npm run test:protocol

# Run AI tier (validates riotplan_build instructions, no real LLM calls)
npm run test:ai

# Run everything
npm run test:all

# Type check
npm run typecheck
```

## Test Matrix

| Command | Transport | Tests Included | Approximate Duration |
|---------|-----------|----------------|----------------------|
| `npm test` | HTTP + STDIO | Scenarios + Protocol + Regressions | ~30s |
| `test:http` | HTTP | Scenarios + Regressions | ~15s |
| `test:stdio` | STDIO | Scenarios + Regressions | ~15s |
| `test:protocol` | HTTP (raw fetch) | Wire-level smoke tests | <5s |
| `test:ai` | HTTP | riotplan_build instruction validation | ~60s |
| `test:all` | HTTP + STDIO | Everything | ~90s |

## Project Structure

```
riotplan-e2e/
├── src/
│   ├── client.ts          # MCP client factory (HTTP + STDIO transports)
│   ├── helpers.ts         # callTool(), listToolNames(), readResource()
│   ├── server.ts          # HTTP server process manager
│   ├── temp.ts            # Temp directory utilities
│   └── types.ts           # Shared types and McpToolError
├── tests/
│   ├── setup/
│   │   ├── http-global.ts    # Vitest globalSetup — starts HTTP server
│   │   ├── stdio-global.ts   # Vitest globalSetup — STDIO setup
│   │   ├── test-context.ts   # useTestContext() hook
│   │   └── plan-builder.ts   # Shared helper: builds plans through lifecycle
│   ├── scenarios/
│   │   ├── lifecycle.test.ts          # Full plan lifecycle end-to-end
│   │   ├── evidence.test.ts           # Evidence CRUD
│   │   ├── idea-mutations.test.ts     # Notes, constraints, questions, set_content
│   │   ├── shaping-mutations.test.ts  # Approaches, feedback, compare, select
│   │   ├── state-transitions.test.ts  # Forward, backward, round-trip transitions
│   │   ├── plan-management.test.ts    # list_plans, status, plan isolation
│   │   ├── context.test.ts            # read_context, project entities
│   │   ├── checkpoints.test.ts        # Checkpoints, history
│   │   ├── step-execution.test.ts     # Start/complete, add/remove/move, reflect
│   │   ├── catalysts.test.ts          # Catalyst list/show/associate
│   │   ├── edge-cases.test.ts         # Boundaries, errors, concurrency
│   │   └── build-protocol.test.ts     # riotplan_build caller-side protocol
│   ├── protocol/
│   │   ├── health.test.ts       # GET /health endpoint
│   │   ├── session.test.ts      # Session lifecycle (POST/DELETE /mcp)
│   │   ├── errors.test.ts       # Error handling edge cases
│   │   └── content-type.test.ts # Content-type and CORS handling
│   ├── ai/
│   │   └── ai-lifecycle.test.ts  # riotplan_build generation instruction validation
│   └── regressions/
│       ├── README.md                              # Regression test guide
│       ├── _template.test.ts                      # Copy-paste template
│       ├── internal-kill-sqlite-enotdir.test.ts   # Known: kill fails on SQLite
│       └── internal-invalid-json-returns-500.test.ts  # Known: 500 on bad JSON
├── fixtures/
│   └── lifecycle/
│       ├── summary.md
│       ├── execution-plan.md
│       └── steps/01-step.md, 02-step.md, 03-step.md
└── scripts/
    └── run-e2e.sh   # Build riotplan + run tests (for kodrdriv integration)
```

## Configuration

Tests read configuration from environment variables set by Vitest global setup:

| Variable | Set by | Description |
|----------|--------|-------------|
| `E2E_SERVER_URL` | `http-global.ts` | HTTP server base URL (e.g. `http://localhost:3001`) |
| `E2E_PLANS_DIR` | Both global setups | Temporary directory for plan files |
| `TRANSPORT` | `vitest.config.ts` | `http` or `stdio` |

## Adding a Regression Test

1. Copy `tests/regressions/_template.test.ts` to `tests/regressions/{issue}-{description}.test.ts`
2. Fill in the issue reference, broken scenario, and expected behavior
3. Run against a broken build to confirm the test fails
4. Apply the fix to RiotPlan
5. Confirm the regression test passes
6. Update `tests/regressions/README.md` to list the new regression

## Known Issues (Documented in Regression Tests)

| Issue | Status | Regression Test |
|-------|--------|-----------------|
| `riotplan_idea kill` fails on SQLite with ENOTDIR | Open | `internal-kill-sqlite-enotdir.test.ts` |
| POST /mcp returns 500 for invalid JSON (should be 400) | Open | `internal-invalid-json-returns-500.test.ts` |

## Build Integration (kodrdriv)

The `scripts/run-e2e.sh` script is designed to be invoked as a step in the kodrdriv publish pipeline:

```bash
# From the kodrdriv workflow
./riotplan-e2e/scripts/run-e2e.sh
```

This script:
1. Builds `riotplan` from source (`npm run build`)
2. Installs e2e dependencies (picks up the new build via `file:` reference)
3. Type-checks the test project
4. Runs the core test suite

Pass `--skip-build` to reuse the existing build, or `--all` to include the AI tier.

## Behavioral Notes (Discovered During Test Development)

- `riotplan_status` returns **operational status** (`pending`/`active`/`complete`), not lifecycle stage. Use `riotplan_read_context` to check lifecycle stage (`idea`/`shaping`/`built`/`executing`/`completed`).
- `riotplan_idea set_content` **replaces the entire IDEA.md** — notes and constraints added before the call are overwritten.
- The StreamableHTTP transport **requires `text/event-stream` in the `Accept` header**. Omitting it causes a 500.
- `riotplan_list_plans` returns a paginated result — do not assume a newly-created plan appears in the first page when many plans exist.
- Project entities in `riotplan_context` require `classification.context_type` and `routing.structure` fields (from `@redaksjon/context` schema), which are not documented in the MCP tool schema.
- `add_narrative` uses the `content` parameter, not `narrative`.
