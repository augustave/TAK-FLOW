# Validated Claims Sheet

- project: TAK-FLOW
- artifact: validated_claims_sheet_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-02
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: C-010, C-011, C-012 revalidated and C-015 added on 2026-07-02 (semantic unification pass); C-012 unblocked later on 2026-07-02 (deterministic EW culling spec + `test:ew` lane)
## Objective

Separate claims TAK-FLOW can support today from those it cannot yet support.

## Claim Inventory

| Claim ID | Claim Statement | Evidence Pointer | Status | Limitations |
| --- | --- | --- | --- | --- |
| C-001 | TAK-FLOW is a theater-level C2 visualization prototype. | `README.md` | Verified | Not evidence of operational deployment readiness. |
| C-002 | The repo currently builds into a deployable static client artifact. | `npm run build`, `dist/` | Verified | Build success is local evidence from the 2026-03-11 validation pass. |
| C-003 | The codebase contains replay capture, import, export, and playback paths. | `src/core/ReplayCapture.js`, `src/core/ReplayPlayer.js`, `tests/replay_roundtrip.spec.js`, `npm run smoke` | Verified | Import round-trip smoke added 2026-07-03 (TP-007): export re-imports byte-identical and a scrubbed frame restores captured state. |
| C-004 | The UI implements provenance-aware designation guardrails and undo behavior. | `src/core/DOMController.js`, `tests/smoke.spec.js` | Verified | Smoke covers guardrail block and undo path; canvas-driven designation placement is still assisted by the `?e2e=1` harness. |
| C-005 | The hostile/EMCON lane uses a dedicated worker and confidence decay logic. | `src/core/opforWorker.js`, `npm run check:worker`, `tests/entity_identity.spec.js`, `tests/opfor_behavior.spec.js`, `tests/uuv_cycle.spec.js` | Verified | Behavior-lane coverage added 2026-07-03 via the worker DIAGNOSTICS channel: pheromone deposition, EMCON bookkeeping, EW-zone round-trip, scenario reset clearing, and UUV dive-cycle EMCON semantics. Behavior-tree branch decisions (evade/flank) remain untested individually. |
| C-006 | The dependency tree is currently free of known vulnerabilities. | `npm audit --json` | Verified | Time-bounded to the 2026-03-11 validation pass. |
| C-007 | The project has CI-backed enforcement for its readiness lanes. | `.github/workflows/verification.yml`, `npm run ci:verify` | Verified | Workflow is present in repo and the same lane passes locally; remote Actions execution has not yet been observed in this pass. |
| C-008 | The project has browser-level automated proof for replay, designation, and advisory workflows. | `tests/smoke.spec.js`, `npm run smoke` | Verified | Current smoke scope is narrow and intentionally targeted. |
| C-009 | TAK-FLOW is an operational command-and-control system suitable for defense fielding. | `README.md`, repo state | Rejected | The repo supports prototype/simulation claims, not deployment claims. |
| C-010 | Exported replay artifacts are fully normalized to the TAK-FLOW project identity. | `tests/smoke.spec.js`, replay export metadata | Verified | Normalized 2026-07-02: runtime emits `tak-flow.replay.v1` and `replay.tak-flow.*.json`; smoke asserts both. Legacy `tak-h.replay.v1` remains importable. |
| C-011 | The replay export path emitted legacy TAK-H identifiers at runtime prior to 2026-07-02. | git history, `src/core/ReplayCapture.js` | Superseded | Resolved by C-010 normalization; retained for audit trail. |
| C-012 | The system correctly identifies and culls tracks undergoing EW alpha-decay. | `docs/defense-readiness/ew_degradation_test_suite_v1.md`, `tests/ew_degradation.spec.js`, `npm run test:ew` | Verified | Re-verified 2026-07-02: `npm run test:ew` now exists and passed 7 consecutive runs. The spec pins determinism via a worker `SET_EW_ZONES` override (play-area-wide zone) and selects only a track with actively decreasing confidence, eliminating the wander-out and static-provenance-score flake modes. |
| C-013 | Ghost tracks are isolated from the strike-designation workflow. | `docs/defense-readiness/ghost_track_precision_report_v1.md`, `tests/ew_degradation.spec.js` | Verified | Isolation and designation blocking re-runnable at small scale via `npm run test:ew`. The 10,000-track burst, heap, and frame-rate figures are report-only: no in-repo harness reproduces them (worker clamps ghost spawns to 1-3 per burst). |
| C-014 | V-JEPA alert-prioritization latency is consistently sub-50ms. | `docs/defense-readiness/alert_prioritization_latency_report_v1.md` | Verified | Report-only: the 32.4ms average has no in-repo measurement harness yet; `npm run smoke` proves the advisory gate functions but does not time it. Gate is a rule-based heuristic threshold, not a learned model. |
| C-015 | Viewport symbology colors stay synchronized with DOM panel tokens, including high-contrast mode. | `src/core/TrackManager.js` `syncPaletteFromCss`, `tests/palette_sync.spec.js`, `docs/defense-readiness/visual_token_manifest_v1.md` | Verified | Automated regression added 2026-07-03: `tests/palette_sync.spec.js` asserts the 3D palette equals the manifest token pairs through a high-contrast round trip in `npm run smoke`. |
| C-016 | Every entity class has a unique render identity across live rendering, replay capture, and legacy replay import. | `src/core/trackSchema.js`, `tests/entity_identity.spec.js`, `tests/unit/trackSchema.test.mjs`, `npm run test:unit` | Verified | Added 2026-07-03. Before this, entityType 1.0 doubled as centroid and hostile single (singles got CENTROID-<n> identities, static provenance confidences, and rendered via the 50-cap centroid mesh) and 2.0 doubled as EMCON single and EMCON centroid. Replay schema bumped to `tak-flow.replay.v2`; v1/tak-h sessions normalize on import by id prefix. Residual: v1 rows recorded under CENTROID- ids cannot be disambiguated retroactively. |
| C-017 | The main client bundle is under an enforced size budget. | `scripts/check_bundle_budget.mjs`, `npm run check:bundle-budget` (in `ci:verify`) | Verified | Added 2026-07-03 (TP-008): warn above 700 KB, fail above 780 KB; `dist/assets/index-*.js` measured 663.3 KB at introduction. |
| C-018 | Scenario load/clear controls execute correctly and reset worker EW state deterministically. | `tests/scenario.spec.js` (TP-009), `npm run smoke` | Verified | Added 2026-07-03: instructor panel load/clear changes track populations, `RESET_STATE` restores default EW zones, and replay exit resumes live motion. |
| C-019 | Submerged UUVs enter EMCON alpha-decay and surfaced UUVs are designable, independent of EW zones. | `tests/uuv_cycle.spec.js`, `npm run smoke` | Verified | Added 2026-07-03 using an e2e-only depth override (the live dive cycle is a ~125s wall-clock sine). Population-level assertions: surfaced type-3 UUVs clear the 0.6 designation gate; submerged type-4 UUVs decay below full confidence; resurfacing restores full confidence. |

## Evidence Links

- `README.md`
- `package.json`
- `docs/defense-readiness/ew_degradation_test_suite_v1.md`
- `docs/defense-readiness/ghost_track_precision_report_v1.md`
- `docs/defense-readiness/alert_prioritization_latency_report_v1.md`
- `tests/ew_degradation.spec.js`
