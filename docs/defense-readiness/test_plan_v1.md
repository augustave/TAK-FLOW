# Test Plan

- project: TAK-FLOW
- artifact: test_plan_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
## Objective

Define the minimum executable validation plan needed to improve assurance for TAK-FLOW.

## Implemented Test Lanes

| Test ID | Command | Objective | Expected Result |
| --- | --- | --- | --- |
| TP-001 | `npm run build` | Verify production bundle generation. | `dist/` is produced successfully. |
| TP-002 | `npm run check:worker` | Verify worker syntax integrity. | Worker parses successfully. |
| TP-003 | `npm run check:bundle` | Verify top-level client bundle graph integrity. | Esbuild bundles `src/main.js` successfully. |
| TP-004 | `npm audit --json` | Verify dependency posture. | `0` known vulnerabilities. |
| TP-005 | `npm run smoke` | Verify designation guardrails/undo, replay transport/export, and recommended-action execution in a browser harness. | All smoke cases pass. |
| TP-006 | `npm run ci:verify` | Verify the combined local readiness lane. | Build, budget, checks, unit, and smoke all pass together. |
| TP-007 | `npx playwright test tests/replay_roundtrip.spec.js` (runs in `npm run smoke`) | Verify replay export/import compatibility and schema naming. | Exported session re-imports byte-identical as `tak-flow.replay.v2` and a scrubbed frame restores captured track state. Implemented 2026-07-03. |
| TP-008 | `npm run check:bundle-budget` | Prevent silent growth of the main client bundle. | `dist/assets/index-*.js` warns above 700 KB and fails above 780 KB. Implemented 2026-07-03 (663.3 KB at introduction). |
| TP-009 | `npx playwright test tests/scenario.spec.js` (runs in `npm run smoke`) | Verify scenario load/clear and deterministic replay state transitions. | Instructor load/clear controls change populations, `RESET_STATE` restores default EW zones in the worker, and replay exit resumes live motion. Implemented 2026-07-03. |
| TP-010 | `npm run test:ew` | Execute the ew_degradation_test_suite_v1.md in CI. | EW degradation and ghost-track mechanics pass. |
| TP-011 | `npm run test:unit` | Node-level unit lane for pure modules (`src/core/trackSchema.js`). | Entity-type contract and legacy replay normalization pass under `node --test`. Implemented 2026-07-03. |

## Planned Next Test Lanes

| Test ID | Command | Objective | Expected Result |
| --- | --- | --- | --- |
| (none open) | — | TP-007/008/009 implemented 2026-07-03; next lanes tracked via the readiness roadmap (palette regression, UUV cycle, behavior diagnostics). | — |

## Exit Criteria

- build and code-integrity lanes pass reliably
- dependency audit remains clean
- browser-level operator workflow verification is present
- CI workflow definition is present in repo
- replay/export contract verification is expanded beyond export-only coverage
- readiness claims are limited to verified lanes only

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
