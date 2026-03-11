# Root Cause Analysis

- project: TAK-FLOW
- artifact: root_cause_analysis_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Issue 1: Runtime Proof Was Missing for Core Operator Flows

### Symptom

The repo previously stopped at build-level validation and source inspection for replay, designation, and advisory logic.

### Root Cause

The original validation surface only checked syntax and bundling. There was no deterministic browser harness for operator workflows.

### Corrective Action

- added Playwright smoke coverage in `tests/smoke.spec.js`
- added a query-gated `?e2e=1` runtime test API for deterministic flow driving
- added `.github/workflows/verification.yml` plus `npm run smoke` and `npm run ci:verify`

## Issue 2: Headless CI Could Not Reliably Initialize the Rendering Stack

### Symptom

Headless Chromium could not create the WebGL renderer, which prevented the app from reaching the DOM and workflow layers needed for smoke testing.

### Root Cause

The repo assumed a fully available WebGL environment during initialization.

### Corrective Action

- added a controlled non-WebGL fallback path in `src/core/MapEngine.js` for `?e2e=1`
- kept smoke assertions focused on operator workflows rather than renderer fidelity

## Issue 3: Repo Identity Still Carries Historical Naming Drift

### Symptom

The repository history and remote configuration still reflect earlier names, which weakens artifact provenance.

### Root Cause

The project evolved through prior TAK-* identities, and the repo metadata has not been fully normalized.

### Corrective Action

- standardize remotes and exported artifact labels on TAK-FLOW
- remove residual historical naming where it still changes reviewer perception

## Issue 4: Bundle Size Is Large for a Single-Client Artifact

### Symptom

The build emits a warning for a large main chunk.

### Root Cause

The application keeps substantial UI, rendering, simulation, and replay logic in a single client bundle.

### Corrective Action

- consider manual chunking or lazy-loading non-critical paths
- establish a bundle budget for future changes

## Issue 5: Replay Exports Still Use Legacy Internal Naming

### Symptom

Replay export runtime still uses the schema label `tak-h.replay.v1` and the filename prefix `replay.tak-h.*.json`.

### Root Cause

Naming cleanup was completed in visible product surfaces first, but replay artifact identifiers were left unchanged in the underlying import/export path.

### Corrective Action

- rename the replay schema/version string to a TAK-FLOW-specific identifier
- rename the exported replay filename prefix
- add a replay round-trip test that asserts both schema compatibility and artifact naming

## Conclusion

TAK-FLOW now has executable browser proof for its most important operator workflows. The remaining readiness work is narrower: provenance normalization, broader scenario coverage, and bundle control.

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/dist/index.html`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/MapEngine.js`
