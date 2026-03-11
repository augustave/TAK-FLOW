# Validated Claims Sheet

- project: TAK-FLOW
- artifact: validated_claims_sheet_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Separate claims TAK-FLOW can support today from those it cannot yet support.

## Claim Inventory

| Claim ID | Claim Statement | Evidence Pointer | Status | Limitations |
| --- | --- | --- | --- | --- |
| C-001 | TAK-FLOW is a theater-level C2 visualization prototype. | `README.md` | Verified | Not evidence of operational deployment readiness. |
| C-002 | The repo currently builds into a deployable static client artifact. | `npm run build`, `dist/` | Verified | Build success is local evidence from the 2026-03-11 validation pass. |
| C-003 | The codebase contains replay capture, import, export, and playback paths. | `src/core/ReplayCapture.js`, `src/core/ReplayPlayer.js`, `npm run smoke` | Verified | Runtime smoke covers export and transport, but replay import is not yet smoke-tested. |
| C-004 | The UI implements provenance-aware designation guardrails and undo behavior. | `src/core/DOMController.js`, `tests/smoke.spec.js` | Verified | Smoke covers guardrail block and undo path; canvas-driven designation placement is still assisted by the `?e2e=1` harness. |
| C-005 | The hostile/EMCON lane uses a dedicated worker and confidence decay logic. | `src/core/opforWorker.js`, `npm run check:worker` | Verified | Worker syntax is verified; broader hostile behavior assertions are still limited. |
| C-006 | The dependency tree is currently free of known vulnerabilities. | `npm audit --json` | Verified | Time-bounded to the 2026-03-11 validation pass. |
| C-007 | The project has CI-backed enforcement for its readiness lanes. | `.github/workflows/verification.yml`, `npm run ci:verify` | Verified | Workflow is present in repo and the same lane passes locally; remote Actions execution has not yet been observed in this pass. |
| C-008 | The project has browser-level automated proof for replay, designation, and advisory workflows. | `tests/smoke.spec.js`, `npm run smoke` | Verified | Current smoke scope is narrow and intentionally targeted. |
| C-009 | TAK-FLOW is an operational command-and-control system suitable for defense fielding. | `README.md`, repo state | Rejected | The repo supports prototype/simulation claims, not deployment claims. |
| C-010 | Exported replay artifacts are fully normalized to the TAK-FLOW project identity. | `tests/smoke.spec.js`, replay export metadata | Blocked | Runtime export still emits `tak-h.replay.v1` and `replay.tak-h.*.json`. |
| C-011 | The replay export path currently emits legacy TAK-H identifiers at runtime. | `npm run smoke`, replay export download | Verified | This is verified behavior, but it is a readiness liability rather than a strength. |

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
