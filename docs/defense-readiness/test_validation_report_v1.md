# Test Validation Report

- project: TAK-FLOW
- artifact: test_validation_report_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Executed Scenarios

| Test ID | Run Date | Result | Evidence Artifact | Notes |
| --- | --- | --- | --- | --- |
| TVR-001 | 2026-03-11 | Pass | `npm run build` | Vite build succeeded and produced `dist/index.html`, `dist/assets/index-G2lSYAfz.js`, and `dist/assets/index-C1j-yP6N.css`. |
| TVR-002 | 2026-03-11 | Pass | `npm run check:worker` | `node --check` passed on `src/core/opforWorker.js`. |
| TVR-003 | 2026-03-11 | Pass | `npm run check:bundle` | Esbuild successfully bundled `src/main.js` to `/tmp/tak-smoke.js`. |
| TVR-004 | 2026-03-11 | Pass | `npm test` | The repo test lane passed, but it still only runs `npm run check`; it is not a broader unit-test suite. |
| TVR-005 | 2026-03-11 | Pass | `npm audit --json` | Audit reported `0` vulnerabilities. |
| TVR-006 | 2026-03-11 | Warning | `npm run build` | Main JS chunk is large (`677.54 kB` minified, `178.16 kB` gzip). |
| TVR-007 | 2026-03-11 | Pass | `npm run smoke` | Browser smoke passed for designation guardrail/undo, replay transport/export, and recommended-action execution. |
| TVR-008 | 2026-03-11 | Pass | `npm run ci:verify` | Combined local verification lane passed: build, code-integrity checks, and browser smoke. |
| TVR-009 | 2026-03-11 | Pass | `.github/workflows/verification.yml` | Repo now contains a CI workflow for build, code-integrity checks, Playwright browser install, and smoke execution. |
| TVR-010 | 2026-03-11 | Warning | `npm run smoke` | Replay export runtime still emits legacy internal naming: schema `tak-h.replay.v1` and filename prefix `replay.tak-h.*.json`. |
| TVR-011 | 2026-03-11 | Pass | `npm run smoke` | Headless browser validation succeeded through the `?e2e=1` runtime path with non-WebGL map fallback, allowing operator-flow verification without GPU rendering. |

## Summary Disposition

- build lane: pass
- code-integrity lane: pass
- dependency vulnerability lane: pass
- browser scenario lane: pass
- CI definition lane: pass
- artifact provenance lane: partially normalized
- overall disposition: strong prototype integrity with executable browser proof, but still carrying bundle and replay-naming debt

## Commands Run

```bash
cd '/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW'
npm run build
npm run check:worker
npm run check:bundle
npm test
npm audit --json
npm run smoke
npm run ci:verify
```

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/playwright.config.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/dist/index.html`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/dist/assets/index-G2lSYAfz.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/dist/assets/index-C1j-yP6N.css`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/MapEngine.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/main.js`
