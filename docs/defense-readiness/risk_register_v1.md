# Risk Register

- project: TAK-FLOW
- artifact: risk_register_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
## Active Risks

| Risk ID | Description | Severity | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| RR-001 | Browser smoke currently covers only a narrow slice of runtime behavior. | Medium | Medium | Expand Playwright coverage to import round-trip, scenario loading, and canvas-driven designation placement. | Closed 2026-07-03 — 22-test browser suite: round-trip (TP-007), scenario controls (TP-009), mission (C-020), determinism (C-024), panels (C-025). Canvas-driven placement remains harness-assisted (C-004 limitation). |
| RR-002 | Bundle size could mask performance regressions on weaker machines. | Medium | Medium | Add bundle budgets or chunking strategy and monitor build output. | Closed 2026-07-03 — enforced budget in `ci:verify` and CI (C-017). |
| RR-003 | Historical repo naming and remote drift weakens portfolio and artifact clarity. | Medium | Medium | Finish TAK-FLOW naming alignment and standardize remotes and artifact labels. | Open — canonical remote decided (`augustave/TAK-FLOW`); legacy remotes (`Tak-G`, `TAK-H`) still configured locally. |
| RR-004 | Replay export schema may drift without explicit contract validation. | Medium | Medium | Add schema checks and import/export round-trip tests. | Closed 2026-07-03 — `trackSchema.js` contract + unit lane + round-trip spec (C-016, C-003). |
| RR-005 | Repo-local CI exists, but remote workflow execution has not yet been observed in this pass. | Low | Medium | Push and confirm the first GitHub Actions verification run. | Closed 2026-07-03 — first green run: https://github.com/augustave/TAK-FLOW/actions/runs/28648999020 (C-007). |
| RR-006 | Replay exports still carry legacy `tak-h` schema and filename identifiers, which weakens provenance clarity during review. | Medium | High | Rename replay schema/version strings and exported filenames to TAK-FLOW, then add contract tests. | Closed 2026-07-02 — `tak-flow.replay.v2` + contract tests (C-010, C-016). |

## Immediate Priorities

1. add replay import round-trip smoke coverage and schema assertions
2. normalize replay export identifiers from `tak-h` to TAK-FLOW
3. address the bundle-size warning with chunking or budget enforcement

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
