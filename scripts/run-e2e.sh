#!/usr/bin/env bash
# run-e2e.sh — Build riotplan locally and run the core e2e test suite.
#
# Usage:
#   ./scripts/run-e2e.sh                   # Build riotplan and run core tests
#   ./scripts/run-e2e.sh --skip-build      # Skip riotplan build (use cached)
#   ./scripts/run-e2e.sh --all             # Run all tests including AI tier
#   RIOTPLAN_DIR=/path/to/riotplan ./scripts/run-e2e.sh
#
# Prerequisites:
#   - Node.js >= 24.0.0
#   - riotplan project at ../riotplan (or RIOTPLAN_DIR)
#   - npm installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RIOTPLAN_DIR="${RIOTPLAN_DIR:-${E2E_DIR}/../riotplan}"

SKIP_BUILD=false
RUN_ALL=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --all)        RUN_ALL=true ;;
    *)            echo "Unknown argument: $arg" && exit 1 ;;
  esac
done

echo "=== RiotPlan E2E Test Runner ==="
echo "E2E project:   ${E2E_DIR}"
echo "RiotPlan dir:  ${RIOTPLAN_DIR}"
echo "Skip build:    ${SKIP_BUILD}"
echo "Run all tests: ${RUN_ALL}"
echo ""

# Verify riotplan directory exists
if [ ! -d "${RIOTPLAN_DIR}" ]; then
  echo "ERROR: RiotPlan directory not found: ${RIOTPLAN_DIR}"
  echo "Set RIOTPLAN_DIR to the path of the riotplan project."
  exit 1
fi

# Step 1: Build riotplan
if [ "${SKIP_BUILD}" = false ]; then
  echo "--- Building riotplan ---"
  cd "${RIOTPLAN_DIR}"
  npm install --silent
  npm run build
  echo "riotplan build complete."
  echo ""
fi

# Step 2: Install e2e dependencies (links to local riotplan via file: dependency)
echo "--- Installing e2e dependencies ---"
cd "${E2E_DIR}"
npm install --silent
echo ""

# Step 3: Type-check
echo "--- Type checking ---"
npm run typecheck
echo "Type check passed."
echo ""

# Step 4: Run tests
echo "--- Running core tests ---"
if [ "${RUN_ALL}" = true ]; then
  npm run test:all
else
  npm test
fi

echo ""
echo "=== All tests passed ==="
