# Operator Runbook

- project: TAK-FLOW
- artifact: operator_runbook_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-02
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: replay naming and known-gaps updated 2026-07-02 (semantic unification pass)
## Objective

Give a reviewer the minimum steps to inspect TAK-FLOW safely and honestly.

## Review Workflow

1. Read `README.md` to understand scope and non-goals.
2. Run `npm ci` if the dependency tree is not trusted.
3. Run `npm run build` to verify the production artifact path.
4. Run `npm test` to verify worker and bundle integrity.
5. Run `npm run smoke` to exercise the current browser workflow lane.
6. Run `npm audit --json` to verify dependency posture.
7. Inspect `src/core/DOMController.js`, `src/core/ReplayCapture.js`, `src/core/ReplayPlayer.js`, and `tests/smoke.spec.js` for the current proof surface.
8. Note that replay artifacts export with `tak-flow.replay.v1` schema naming; legacy `tak-h.replay.v1` exports remain importable.

## Known Good Review Commands

```bash
cd '/Users/taoconrad/Dev/GitHub 4/TAK-FLOW'
npm ci
npm run build
npm test
npm run smoke
npm audit --json
```

## Known Gaps

- remote GitHub Actions execution is not yet observed in this pass
- replay import round-trip is not in the smoke lane yet
- bundle size warning remains on build
- `tests/ew_degradation.spec.js` EMCON culling test is nondeterministic (random track selection) and observed failing on 2026-07-02; needs deterministic EW-zone track pinning
- high-contrast palette sync (3D ↔ CSS tokens) is browser-verified but has no automated regression test

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayPlayer.js`
