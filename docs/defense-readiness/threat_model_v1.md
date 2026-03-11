# Threat Model

- project: TAK-FLOW
- artifact: threat_model_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Identify the highest integrity and misuse risks for the current TAK-FLOW repository.

## Threats

| Threat ID | Threat | Impact | Current Posture |
| --- | --- | --- | --- |
| TM-001 | Prototype visualization is mistaken for operational C2 software. | High | Mitigated by README framing, but still requires explicit portfolio language. |
| TM-002 | Runtime behavior outside the current smoke path drifts without detection. | High | Partially mitigated by Playwright smoke, but coverage is still narrow. |
| TM-003 | Replay/export schema drifts and breaks audit restoration. | High | Open. |
| TM-004 | Large single-bundle client artifact hides performance regressions until late review. | Medium | Open. |
| TM-005 | Historical naming and remote identity drift confuse artifact provenance. | Medium | Open. |
| TM-006 | Replay exports with legacy `tak-h` naming create avoidable reviewer confusion about system identity and lineage. | Medium | Open. |
| TM-007 | Headless CI could regress if the fallback initialization path drifts from the main app contract. | Medium | Partially mitigated by current smoke passing through the fallback path. |

## Highest-Risk Current Issue

The largest remaining assurance problem is no longer complete absence of runtime proof. It is the narrowness of that proof: replay import, broader scenario coverage, and artifact naming are still not fully enforced.

## Mitigations

- keep the repo framed as a simulation/C2 prototype only
- run build and smoke checks in CI via `.github/workflows/verification.yml`
- preserve naming consistency and repo identity in exported artifacts
- add explicit schema checks for replay snapshots and exported filenames
- expand Playwright coverage beyond the current three smoke cases

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/MapEngine.js`
