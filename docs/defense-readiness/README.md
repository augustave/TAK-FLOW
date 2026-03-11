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

Important readiness limit:
- replay artifacts still carry the internal schema/version string `tak-h.replay.v1` and the export filename prefix `replay.tak-h.*.json`; that is now runtime-verified, but it is still a provenance problem

Artifacts:
- `market_requirements_doc.md`
- `mission_conops_v1.md`
- `architecture_spec_v1.md`
- `interface_control_doc_v1.md`
- `threat_model_v1.md`
- `risk_register_v1.md`
- `test_plan_v1.md`
- `test_validation_report_v1.md`
- `root_cause_analysis_v1.md`
- `validated_claims_sheet_v1.md`
- `operator_runbook_v1.md`
- `case_study_v1.md`
