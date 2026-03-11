# Architecture Specification

- project: TAK-FLOW
- artifact: architecture_spec_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Summarize the current architecture, component responsibilities, and evidence-producing pathways.

## Top-Level Architecture

- entrypoint: `src/main.js`
- core orchestration:
  - `src/core/TrackManager.js`
  - `src/core/DOMController.js`
  - `src/core/MapEngine.js`
  - `src/core/OpsLog.js`
- simulation and worker lanes:
  - `src/core/opforWorker.js`
  - `src/core/DecoySim.js`
  - `src/core/SigintFeed.js`
- replay and audit:
  - `src/core/ReplayCapture.js`
  - `src/core/ReplayPlayer.js`
- UI support:
  - `src/core/HUDController.js`
  - `src/core/DrawController.js`
  - `src/core/SplatController.js`
- automated verification:
  - `tests/smoke.spec.js`
  - `playwright.config.js`
  - `.github/workflows/verification.yml`
- visuals:
  - `src/shaders.js`
  - `src/shaders/*`
  - `src/style.css`

## Data and Control Flow

1. `main.js` bootstraps the map engine, DOM controller, track manager, overlays, replay systems, and animation loop.
2. `TrackManager` owns live track state, rendering buffers, swarm telemetry, provenance state, and replay snapshots.
3. `DOMController` binds track state to panels, designation logic, recommendation logic, and telemetry badges.
4. `opforWorker.js` computes hostile swarm and EMCON/ghost-track state off the main thread.
5. `ReplayCapture` and `ReplayPlayer` serialize and restore operator-facing state for audit and review.
6. `?e2e=1` enables a deterministic smoke harness and non-WebGL fallback path so browser automation can validate operator flows in headless CI.

## Architectural Strengths

- clear modular split between render, domain logic, interaction logic, and replay/audit support
- explicit uncertainty and provenance encoding in source, not only in design language
- worker-backed hostile lane reduces main-thread coupling
- replay architecture is already present instead of being just a roadmap item
- repo now contains executable browser smoke and CI workflow definitions tied to the real app

## Architectural Gaps

- smoke coverage is still targeted, not comprehensive
- local tests outside Playwright are syntax and bundle integrity checks, not broad scenario assertions
- bundle output includes a large main chunk (`677.54 kB` minified) that should be monitored
- replay export identifiers still use legacy `tak-h` schema and filename naming
- repository naming and upstream history are still transitioning, which can confuse artifact provenance

## Acceptance Criteria

- architecture description matches current repo structure
- replay, provenance, advisory logic, and automated proof paths are treated as first-class system components
- limitations on coverage depth, artifact naming, and runtime proof are called out explicitly

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/main.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/MapEngine.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
