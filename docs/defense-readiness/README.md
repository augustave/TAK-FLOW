# TAK-FLOW Defense Readiness

This folder captures the current defense-readiness evidence for TAK-FLOW as a theater-level C2 visualization and simulation prototype.

Current repo-grounded status as of 2026-03-11:
- `npm run build`: passing
- `npm run check:worker`: passing
- `npm run check:bundle`: passing
- `npm test`: passing (`npm run check` only)
- `npm run smoke`: passing
- `npm run ci:verify`: passing locally
- `npm audit --json`: `0` known vulnerabilities
- CI workflow: present at `.github/workflows/verification.yml`
- browser smoke coverage: present for designation guardrails/undo, replay transport/export, and recommended-action execution
- largest technical gaps: bundle-size control, replay schema/export naming normalization, and broader scenario coverage beyond the current smoke lane

Concrete evidence from this pass:
- production artifact generated at `dist/index.html`
- main bundle emitted at `dist/assets/index-G2lSYAfz.js`
- main bundle warning: `677.54 kB` minified
- replay/import-export logic present in `src/core/ReplayCapture.js` and `src/core/ReplayPlayer.js`
- hostile/EMCON lane present in `src/core/opforWorker.js`
- browser smoke suite present in `tests/smoke.spec.js`
- headless smoke uses the `?e2e=1` path with a non-WebGL fallback map engine so operator workflows can be validated in CI without GPU rendering

Resolved readiness limit (2026-07-02):
- replay artifacts now emit the schema/version string `tak-flow.replay.v1` and the export filename prefix `replay.tak-flow.*.json` (`src/core/ReplayCapture.js`, asserted by `tests/smoke.spec.js`; see claim C-010). Legacy `tak-h.replay.v1` sessions remain importable.

Artifacts:
- `market_requirements_doc.md` (v2)
- `mission_conops_v1.md` (v2 — executable canonical mission)
- `architecture_spec_v1.md` (v2)
- `interface_control_doc_v1.md` (v2)
- `threat_model_v1.md`
- `risk_register_v1.md`
- `test_plan_v1.md`
- `test_validation_report_v1.md`
- `root_cause_analysis_v1.md`
- `validated_claims_sheet_v1.md` (C-001…C-028)
- `operator_runbook_v1.md`
- `case_study_v1.md`
- `capture_strategy_deck_v1.md` (every statement claims-backed)
- `ui_layout_contract_v1.md` (zone/z-index/palette/typography contract, real values)
- `ew_degradation_test_suite_v1.md` / `ghost_track_precision_report_v1.md` / `alert_prioritization_latency_report_v1.md` (ingested evidence reports with provenance headers)
