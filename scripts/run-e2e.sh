#!/usr/bin/env bash
# run-e2e.sh — Build riotplan locally and run the core e2e test suite.
#
# Usage:
#   ./scripts/run-e2e.sh                   # Build riotplan and run core tests
#   ./scripts/run-e2e.sh --skip-build      # Skip riotplan build (use cached)
#   ./scripts/run-e2e.sh --mode full       # Run local-http + protocol
#   ./scripts/run-e2e.sh --mode all        # Run everything including AI tier
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
MODE="core"

while (($#)); do
  case "$1" in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --all)
      MODE="all" # backwards compatibility
      shift
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --mode)
      shift
      MODE="${1:-}"
      if [ -z "${MODE}" ]; then
        echo "Missing value for --mode"
        exit 1
      fi
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

case "${MODE}" in
  core|full|all) ;;
  *)
    echo "Invalid mode: ${MODE}"
    echo "Valid modes: core, full, all"
    exit 1
    ;;
esac

echo "=== RiotPlan E2E Test Runner ==="
echo "E2E project:   ${E2E_DIR}"
echo "RiotPlan dir:  ${RIOTPLAN_DIR}"
echo "Skip build:    ${SKIP_BUILD}"
echo "Mode:          ${MODE}"
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

# Step 2: Install e2e dependencies
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
echo "--- Running ${MODE} tests ---"
case "${MODE}" in
  core) npm run test:core ;;
  full) npm run test:full ;;
  all)  npm run test:all ;;
esac

echo ""
echo "=== All tests passed ==="
