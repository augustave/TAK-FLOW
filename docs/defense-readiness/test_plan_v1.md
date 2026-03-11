# Test Plan

- project: TAK-FLOW
- artifact: test_plan_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

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
| TP-006 | `npm run ci:verify` | Verify the combined local readiness lane. | Build, checks, and smoke all pass together. |

## Planned Next Test Lanes

| Test ID | Command | Objective | Expected Result |
| --- | --- | --- | --- |
| TP-007 | planned replay import round-trip smoke | Verify replay export/import compatibility and schema naming. | Exported session reloads without schema loss and carries normalized TAK-FLOW identifiers. |
| TP-008 | planned bundle budget check | Prevent silent growth of the main client bundle. | Build fails or warns against a defined threshold. |
| TP-009 | planned scenario smoke | Verify scenario load/clear and deterministic replay state transitions. | Critical scenario controls execute correctly under browser automation. |

## Exit Criteria

- build and code-integrity lanes pass reliably
- dependency audit remains clean
- browser-level operator workflow verification is present
- CI workflow definition is present in repo
- replay/export contract verification is expanded beyond export-only coverage
- readiness claims are limited to verified lanes only

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
