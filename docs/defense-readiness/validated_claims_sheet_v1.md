# Validated Claims Sheet

- project: TAK-FLOW
- artifact: validated_claims_sheet_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-02
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: C-010, C-011, C-012 revalidated and C-015 added on 2026-07-02 (semantic unification pass)
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
| C-010 | Exported replay artifacts are fully normalized to the TAK-FLOW project identity. | `tests/smoke.spec.js`, replay export metadata | Verified | Normalized 2026-07-02: runtime emits `tak-flow.replay.v1` and `replay.tak-flow.*.json`; smoke asserts both. Legacy `tak-h.replay.v1` remains importable. |
| C-011 | The replay export path emitted legacy TAK-H identifiers at runtime prior to 2026-07-02. | git history, `src/core/ReplayCapture.js` | Superseded | Resolved by C-010 normalization; retained for audit trail. |
| C-012 | The system correctly identifies and culls tracks undergoing EW alpha-decay. | `ew_degradation_test_suite_v1.md`, `tests/ew_degradation.spec.js` | Blocked | The cited `npm run test:ew` script does not exist in `package.json`. The culling spec selects a nondeterministic track and was observed failing on 2026-07-02 on both pre- and post-change trees; evidence lane needs deterministic track pinning before this claim can be re-verified. |
| C-013 | Ghost tracks are isolated from the strike-designation workflow. | `ghost_track_precision_report_v1.md`, `tests/ew_degradation.spec.js` | Verified | 100% isolation proven under 10,000 track burst load. |
| C-014 | V-JEPA alert-prioritization latency is consistently sub-50ms. | `alert_prioritization_latency_report_v1.md` | Verified | Measured average latency of 32.4ms during swarm fractures. |
| C-015 | Viewport symbology colors stay synchronized with DOM panel tokens, including high-contrast mode. | `src/core/TrackManager.js` `syncPaletteFromCss`, `src/main.js` `isHighContrast` subscription, `docs/defense-readiness/visual_token_manifest_v1.md` | Verified | Verified 2026-07-02 via live browser eval: 3D palette follows CSS custom properties through a high-contrast on/off round trip. No automated regression test yet. |

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/ew_degradation_test_suite_v1.md`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/ghost_track_precision_report_v1.md`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/alert_prioritization_latency_report_v1.md`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/ew_degradation.spec.js`
