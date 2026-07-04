# Mission CONOPS

- project: TAK-FLOW
- artifact: mission_conops_v1
- version: v2
- owner: Tao Conrad
- last_updated: 2026-07-03
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: v2 (2026-07-03) adds the executable canonical mission; every step is asserted end-to-end by `tests/conops_mission.spec.js`
## Objective

Describe how TAK-FLOW would be used today in a defense-adjacent workflow — and prove it: the canonical mission below is not narrative-only, it runs as a browser-automated scenario in the standard test lane (`npm run smoke`).

## Operational Concept

TAK-FLOW is a pre-deployment operator-cognition and decision-support prototype. An analyst loads a scenario, observes multi-domain tracks under uncertainty, inspects recommendation and provenance state, and reviews replayable telemetry after designation or swarm-advisory events.

## Canonical Mission: "Contested Littoral Watch"

Each step names the operator action, the UI surface it exercises, and the automation hook that asserts it (`tests/conops_mission.spec.js`, phases 1–9).

| # | Mission beat | UI surface | Automation hook |
| --- | --- | --- | --- |
| 1 | Instructor loads the MASSED SWARM scenario (1,500+ tracks). | `SCENARIO OPS [INSTRUCTOR]` panel: profile select + LOAD SCENARIO | `#scenario-profile-select`, `#btn-scenario-load`, `listTracks()` population |
| 2 | Watchfloor picture established: track table and live worker lane active. | TRACK LOG panel | `#track-tbody tr` visible |
| 3 | Adversary SIGINT decoy burst injects ghost tracks at low confidence (< 0.5). | DECOY SIM (SAFE) panel | `injectGhostTracks(5)`, ghost confidence assertion |
| 4 | Operator attempts to designate a ghost — the zero-trust gate blocks it. | Strike designation flow + alert banner | `stageDesignation` → `strike-blocked`, `#alert-text` shows `INSUFFICIENT TRACK PROVENANCE` |
| 5 | Theater-wide EW jamming: tracks enter EMCON alpha-decay; ops log records datalink loss; jamming then lifts. | 3D viewport EMCON ghosting + OPS/AUDIT LOG | `setEwZone(0,0,1000)`, live confidence < 1.0, ops-log `DATALINK SEVERED` entry, `setEwZone(0,0,10)` |
| 6 | Swarm fracture: the rule-based advisory gate (SIM heuristic, no model) goes critical. | RECOMMENDED ACTIONS panel | `forceTelemetry({cohesion:0.03, milling:0.58, activeCount:150})`, badge `CRITICAL` |
| 7 | Operator executes the recommended wide-area 3DGS counterfactual recon macro. | `[ EXECUTE ] RECON [3DGS]` button | `executeRecommendedAction()` → counterfactual scan active |
| 8 | Provenance-clean designation on a high-confidence track, then rollback. | Confirm strip, reason select, undo strip | `stageDesignation` ok → keyboard confirm → `#btn-undo` |
| 9 | After-action: mission marker captured; replay artifact exportable. | Replay transport / export | `captureReplayEvent('CONOPS_MISSION_COMPLETE')`, export metadata `tak-flow.replay.v2`, both buffers populated |

Mission runtime under automation: ~5 seconds of active phases (well inside the smoke-lane budget).

Automation scale note: locally the mission runs at canonical MASSED SWARM scale (1,500+ tracks). On shared CI runners the identical mission beats execute at drill (patrol) scale — the swarm profile's per-frame kinematics exceed those runners' CPU. e2e sessions likewise boot at drill scale; swarm is loaded explicitly where a spec needs it.

## Supported Mission Themes

- uncertainty-aware track management
- swarm fracture and re-merge advisory workflows (rule-based heuristic gate — no learned model)
- provenance-gated designation decisions
- replay-assisted operator auditability
- terrain-informed hostile swarm simulation via a synthetic AlphaEarth-style embedding stub

## Operational Limits

- no validated integration with real sensors, radios, or TAK servers
- the ops log is a severity-sorted 50-entry queue: lower-severity audit entries (e.g. strike-abort warnings) are evicted under swarm alert load; the alert banner is the reliable operator surface for those
- no formal latency, memory, or cross-browser acceptance thresholds are encoded
- the advisory gate and terrain embeddings are simulation stubs and are labeled as such in the UI and architecture spec

## Current Evidence-Based Mission Claims

- the canonical mission above executes end-to-end in browser automation (`tests/conops_mission.spec.js`, in `npm run smoke`)
- build, code-integrity, unit, bundle-budget, smoke, and combined verification lanes execute successfully
- the repo contains executable proof for replay round-trip, designation guardrails/undo, EMCON decay/culling, ghost isolation, scenario controls, palette token sync, and UUV dive-cycle EMCON semantics
- the bundle is deployable as a static client artifact

## Acceptance Criteria

- project is presented as a prototype decision-support surface, not an operational control product
- the canonical mission uses only operations the sim performs today; every step has an automation hook
- verified claims are tied to executed commands, browser automation, or direct runtime observation
- unverified operational claims remain out of scope

## Evidence Links

- `tests/conops_mission.spec.js`
- `tests/smoke.spec.js`
- `index.html`
- `src/core/DOMController.js`
- `src/core/ReplayCapture.js`
- `src/core/ReplayPlayer.js`
- `docs/defense-readiness/validated_claims_sheet_v1.md`
