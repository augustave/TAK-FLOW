# Mission CONOPS

- project: TAK-FLOW
- artifact: mission_conops_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Describe how TAK-FLOW would be used today in a defense-adjacent workflow.

## Operational Concept

TAK-FLOW is a pre-deployment operator-cognition and decision-support prototype. An analyst loads a scenario, observes multi-domain tracks under uncertainty, inspects recommendation and provenance state, and reviews replayable telemetry after designation or swarm-advisory events.

## Nominal Workflow

1. Load a scenario and initialize the tactical view.
2. Monitor high-density tracks, trust state, and swarm kinematics.
3. Use UPF selection, recommendations, and provenance-aware designation logic to inspect targets.
4. Capture or replay key events for after-action analysis.
5. Export telemetry artifacts for later review.

## Supported Mission Themes

- uncertainty-aware track management
- swarm fracture and re-merge advisory workflows
- provenance-gated designation decisions
- replay-assisted operator auditability
- terrain-informed hostile swarm simulation via AlphaEarth-style embeddings

## Operational Limits

- no validated integration with real sensors, radios, or TAK servers
- browser smoke covers only a narrow workflow slice, not the entire operator surface
- CI workflow is now present in-repo, but remote workflow execution has not been observed in this pass
- no formal latency, memory, or cross-browser acceptance thresholds are encoded

## Current Evidence-Based Mission Claims

- build, code-integrity, smoke, and local combined verification lanes execute successfully
- the repo contains executable proof for replay transport/export, designation guardrails/undo, and recommended-action execution
- the repo contains explicit logic for replay capture, replay restoration, advisory supersession, provenance checks, EMCON handling, and designation undo flows
- the bundle is deployable as a static client artifact

## Acceptance Criteria

- project is presented as a prototype decision-support surface, not an operational control product
- verified claims are tied to executed commands, browser smoke, or direct runtime observation
- unverified operational claims remain out of scope

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/index.html`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/.github/workflows/verification.yml`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
