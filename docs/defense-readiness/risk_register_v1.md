# Risk Register

- project: TAK-FLOW
- artifact: risk_register_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Active Risks

| Risk ID | Description | Severity | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| RR-001 | Browser smoke currently covers only a narrow slice of runtime behavior. | Medium | Medium | Expand Playwright coverage to import round-trip, scenario loading, and canvas-driven designation placement. | Open |
| RR-002 | Bundle size could mask performance regressions on weaker machines. | Medium | Medium | Add bundle budgets or chunking strategy and monitor build output. | Open |
| RR-003 | Historical repo naming and remote drift weakens portfolio and artifact clarity. | Medium | Medium | Finish TAK-FLOW naming alignment and standardize remotes and artifact labels. | Open |
| RR-004 | Replay export schema may drift without explicit contract validation. | Medium | Medium | Add schema checks and import/export round-trip tests. | Open |
| RR-005 | Repo-local CI exists, but remote workflow execution has not yet been observed in this pass. | Low | Medium | Push and confirm the first GitHub Actions verification run. | Open |
| RR-006 | Replay exports still carry legacy `tak-h` schema and filename identifiers, which weakens provenance clarity during review. | Medium | High | Rename replay schema/version strings and exported filenames to TAK-FLOW, then add contract tests. | Open |

## Immediate Priorities

1. add replay import round-trip smoke coverage and schema assertions
2. normalize replay export identifiers from `tak-h` to TAK-FLOW
3. address the bundle-size warning with chunking or budget enforcement

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
