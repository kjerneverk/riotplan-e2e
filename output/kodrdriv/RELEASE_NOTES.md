## Main story
This release is primarily a maintenance update to keep the end-to-end suite in sync with current Riotplan lifecycle behavior and to finalize the package metadata for the 1.0.3 release.

## Changes

### E2E scenario correctness: explicit stage transitions
- Updated the **Evidence CRUD** scenario to transition stages using `riotplan_transition` rather than relying on `riotplan_shaping({ action: 'start' })` to implicitly change the plan stage.
  - The test now explicitly transitions `idea → shaping` before verifying evidence persists across the stage change.

**Why it matters:** if your workflows/tests assumed shaping “start” also changed the lifecycle stage, they may now produce false failures (or test the wrong thing). This suite now reflects the explicit transition requirement.

### Package metadata updates (release housekeeping)
- Updated `package.json` metadata/scripts and set the package version to **1.0.3**.

## Impact
- **Users (running the E2E suite):** more reliable evidence lifecycle coverage when validating stage transitions.
- **Developers (adding/updating scenarios):** prefer `riotplan_transition` for stage changes; don’t assume other tools implicitly transition lifecycle stages.

## Breaking changes
- No breaking changes detected in this repo’s public surface area for this release.
- Note: behavior relied upon by tests changed upstream (implicit stage transition is no longer assumed). If you have custom scenarios based on the old assumption, update them to call `riotplan_transition` explicitly.