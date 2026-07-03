# Architecture Specification

- project: TAK-FLOW
- artifact: architecture_spec_v1
- version: v2
- owner: Tao Conrad
- last_updated: 2026-07-03
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: v2 is a code-grounded deepening pass (2026-07-03) — module roles, dataflow, stub labels, and gaps below are transcribed from the source in this repo; line counts via `wc -l`

## Objective

Summarize the current architecture, component responsibilities, and evidence-producing pathways.

## Module Map

Everything under `src/` (line counts as of 2026-07-03):

| module | LOC | responsibility |
| --- | --- | --- |
| `src/main.js` | 626 | Entrypoint: constructs all subsystems, wires the `?e2e` test harness (`__TAK_FLOW_TEST__`), raycast selection/designation interactions, keyboard bindings, 1 Hz `SYNC_ENV` push to the worker, camera logic, and the `requestAnimationFrame` loop. |
| `src/core/TrackManager.js` | 1864 | Owner of live track state and all track meshes (hostile/friendly/unknown instanced meshes plus centroid cap 50, EMCON cap 2000, UUV cap 500). Runs swarm boids and the wall-clock UUV dive cycle, sends/receives the worker frames, computes swarm order parameters (polarization, milling, cohesion, COM, activeCount), provenance and confidence scoring, UPF spatial-cone attention, 3DGS recon splat and counterfactual scan overlays, replay snapshot build/restore, and scenario reset. |
| `src/core/opforWorker.js` | 841 | OPFOR web worker: behavior tree (evade → AlphaEarth terrain cost → flank), pheromone grid (deposit/evaporate/gradient-ascent steering), spatial-hash clustering (cell 2.5, > 15 neighbors, polarization > 0.85 → centroid), EMCON/ghost-track state machine over EW zones, decoy-driven SIGINT ghosts; emits render buffer + `ui` metadata + `intents`, plus `TRACK_LOST` and `DIAGNOSTICS`. |
| `src/core/DOMController.js` | 1010 | DOM bindings: track table (filter/sort), active-track panel, two-stage designation confirm + undo window, `canInitiateStrike` gate (confidence ≥ 0.6 or recon override), telemetry panel, the "V-JEPA" advisory gate and its recon macro, replay-mode DOM restore. |
| `src/core/OpsLog.js` | 404 | Prioritized ops log (severity desc → timeToEvent asc → timestamp desc; capped at 50) plus the full telemetry report exporter (`buildTelemetryReport`) that snapshots every subsystem via the export-context getter. |
| `src/core/ReplayCapture.js` | 213 | 4 Hz ring buffer (cap 14400) + event snapshots; snapshot schema `tak-flow.replay.v2`; import/export with legacy (`tak-flow.replay.v1`, `tak-h.replay.v1`) normalization via `trackSchema`. |
| `src/core/ReplayPlayer.js` | 351 | Replay transport UI: play/pause/scrub/speed/event-jump, marker rail, live-state snapshot on entry and restore on close, imported-session backup/restore. |
| `src/core/MapEngine.js` | 180 | THREE scene/camera/renderer + post chain (bloom, film), procedural terrain shader plumbing, SAM rings, and the synthetic 64-D "AlphaEarth" tensor; provides the non-WebGL fallback engine used under `?e2e=1`. |
| `src/core/DecoySim.js` | 189 | RF decoy simulation: SSID/MAC/channel decoy sets from profiles, burst scheduler (2.2–4.2 s) incrementing `decoySim.burstCount` in the store, SIGINT feed messages (explicitly `(NO TX)` — no emission). |
| `src/core/DrawController.js` | 148 | Freehand polygon zones (Z key / button): active line preview, fill + outline groups flagged `isTerrainFeature` for map-mode fading. |
| `src/core/HUDController.js` | 152 | HUD chrome: density/contrast/motion toggles, panel opacity token, drawer toggles, Zulu clocks/DTG, tactical↔archival skin switch. |
| `src/core/SplatController.js` | 170 | Procedural 3DGS-style recon cloud: 2000 instanced ellipsoids + wireframe core + scan plane, follows the recon target track. |
| `src/core/SigintFeed.js` | 103 | Scripted message ticker (15 canned messages, 4.5–7.5 s cadence), filter chips, hover-pause. Not a live feed — see Stub Labeling. |
| `src/core/Store.js` | 52 | Minimal pub/sub key-value store (subscribe fires immediately; set only on identity change). |
| `src/core/trackSchema.js` | 60 | Pure shared contract: input/render strides, `ENTITY_TYPE` table, EMCON/centroid/UUV predicates, legacy replay entity-type normalizer. Unit-tested under node. |
| `src/shaders.js` | 256 | Map GLSL: fbm/domain-warp terrain, the "AlphaEarth embedding decoder" (dims 12/45/8), SAM rings, explosion rings, archival skin. |
| `src/data/mockData.js` | 85 | Scenario generator (`swarm` 1500 / `patrol` 150 / `symmetric` 800 random tracks + 10 fixed tracks incl. UUVs), SIGINT message bank, decoy profiles, provenance sources/confidence labels. |

## Data and Control Flow

1. `main.js` bootstraps map engine, controllers, track manager, replay systems, and the animation loop; `window.opsLogInstance` is set as a global for cross-module logging.
2. Per animation frame (live mode only): `TrackManager.updateSwarmBoids` advances kinematics, then `sendStateToWorker` posts the stride-9 input frame (transferred) with `{decoyActive, decoyBurstCount}`; `workerPending` enforces one frame in flight.
3. In the worker: input rows are split hostile/friendly (allegiance 2.0 dropped) → behavior-tree intents per hostile → pheromone deposit/gradient steering → spatial-hash clustering into centroids → EMCON masking against EW zones (submerged UUVs always masked) → decoy ghost update.
4. Worker replies with the stride-10 render buffer + stride-4 `intents` (both transferred) + `ui {centroids, emcon, ghosts}`. `TrackManager` applies intents to boids, routes render rows to the centroid/EMCON/UUV/hostile instanced meshes, rebuilds `liveTrackStateById`, hides centroid members, and writes one-shot EW/centroid ops-log entries.
5. Side channels: worker → `TRACK_LOST` (track removed from scope + INFO log) and `DIAGNOSTICS` (cached for the e2e contract); main → `FORCE_CONFIDENCE`, `SET_EW_ZONES`, `RESET_STATE` (on scenario reset), and `SYNC_ENV` at 1 Hz from `main.js` (friendly targets + two hardcoded SAM threat zones) feeding pheromone deposition.
6. `DOMController.update` reads swarm telemetry each frame (skipped in replay mode) and drives panels, badges, and the V-JEPA advisory gate; `OpsLog` and `Store` fan state out to DOM and replay.
7. `ReplayCapture` snapshots the operator context at 4 Hz + on events; `ReplayPlayer` enters replay mode (freezing capture and worker frame sends), scrubs snapshots through `TrackManager`/`DOMController` restore paths, and restores live state on close.
8. `?e2e=1` exposes `__TAK_FLOW_TEST__` (26 methods, see ICD §5) and enables the non-WebGL fallback path so browser automation can validate operator flows in headless CI.

## Stub Labeling

Named capabilities that are explicitly not what their names imply:

- **"V-JEPA" = rule-based heuristic advisory gate.** `DOMController.isVjepaThreatAnxietyCondition` is a threshold rule over live swarm order parameters: `cohesion <= 0.05 && milling >= 0.40 && activeCount > 100`. No learned model, no video prediction — the name is branding for the advisory gate. Scan radius is `clamp(8 + activeCount * 0.04, 10, 18)` anchored on the swarm center of mass; onset/clear are captured as replay events (`V_JEPA_ONSET`, `V_JEPA_CLEAR`).
- **"AlphaEarth" = synthetic terrain-embedding stub.** `MapEngine` fills a `Float32Array(64)` with `Math.random()` and pins dims 45 = 0.8 (vegetation), 22 = 0.6 (iron), 8 = 0.2 (hydrology). The shader "decoder" and the worker's `EvaluateAlphaEarthTerrainCost` read dims 12/45/8 to modulate procedural fbm gradients. No Google AlphaEarth embeddings and no real geodata are involved. The worker-side feed is additionally dormant (see Gaps).
- **`SigintFeed` = scripted message ticker.** Cycles 15 canned messages from `mockData.js` on a 4.5–7.5 s timer; no receiver, no live SIGINT.

## Subsystem Status Notes

- **Pheromone grid: computed live, not yet exported or rendered.** The worker maintains the full grid (deposit −5.0 in threat zones / +0.1 validated traces, evaporation 0.005/tick, 8-neighbor gradient-ascent steering at weight 1.5) and it shapes hostile intents, but only the cell count leaves the worker (`DIAGNOSTICS.pheromoneCells`). Grid export/rendering is planned activation work.
- **`?e2e=1` non-WebGL fallback for CI.** `setupMapEngine` catches WebGL renderer construction failure and, only when `allowRendererFallback` (set from the e2e flag), returns a fallback engine: plain canvas tagged `data-renderer-mode="fallback"`, no-op composer, same scene-graph surface. Headless smoke runs do not require a GPU.
- **Bundle budget enforcement.** `scripts/check_bundle_budget.mjs` (TP-008) fails the build above 780 KB and warns above 700 KB for the single `dist/assets/index-*.js` chunk; wired into `npm run check:bundle-budget` and the `ci:verify` lane. Note: `.github/workflows/verification.yml` currently runs build + integrity checks + smoke and does **not** invoke the budget script or the unit lane — enforcement is local/`ci:verify` only.
- **Verification lanes.** `npm test` = worker syntax check + esbuild bundle check; `test:unit` = node test over `tests/unit/trackSchema.test.mjs`; `smoke` = 9 Playwright specs (`smoke`, `scenario`, `conops_mission`, `entity_identity`, `opfor_behavior`, `palette_sync`, `replay_roundtrip`, `uuv_cycle`, `ew_degradation`) against the e2e harness.

## Architectural Strengths

- clear modular split between render, domain logic, interaction logic, and replay/audit support
- explicit uncertainty and provenance encoding in source, not only in design language
- worker-backed hostile lane reduces main-thread coupling; render/intents buffers are ownership-transferred (zero-copy)
- `trackSchema.js` gives worker, render path, and replay pipeline a single, unit-tested contract (entityType collision resolved 2026-07-03)
- replay architecture is already present instead of being just a roadmap item, with a legacy-import normalization path
- repo contains executable browser smoke, unit, bundle-budget, and CI workflow definitions tied to the real app

## Architectural Gaps

Resolved since v1 and removed from this list: replay export naming (resolved 2026-07-02 — runtime emits `tak-flow.replay.v2` / `replay.tak-flow.*.json`, legacy imports still accepted); render-buffer entityType collision (resolved 2026-07-03 via `src/core/trackSchema.js`); unmonitored bundle growth (now bounded by `scripts/check_bundle_budget.mjs`, warn 700 KB / fail 780 KB).

Current, each verified in source on 2026-07-03:

- **Non-swarm hostile tracks receive no individual render path.** `sendStateToWorker` serializes only `isSwarm` tracks, and the hostile instanced mesh count is set solely from worker render rows in `animateTracks`; the per-track hostile loop only updates `tr.pos` and never writes instance matrices. Fixed hostiles (e.g. `TK-4071 ARMOR`) exist in the track table, ops log, and selection logic but draw no icon in the hostile layer.
- **`window.opsLogInstance` global coupling.** `TrackManager` (EW/centroid/track-loss logging and the AlphaEarth buffer fetch), `ReplayCapture` (capture banner), and every Playwright spec reach through the global. Live evidence of the hazard: `sendStateToWorker` reads `window.opsLogInstance.exportContext`, which does not exist (`OpsLog` exposes `exportContextGetter`), so the `alphaEarthBuffer` payload key is silently never populated and worker terrain-cost steering is dormant.
- **`workerPending` boolean handshake.** A single boolean is the only flow control on the worker frame loop — no sequence numbers, no timeout recovery; typed replies intentionally skip clearing it, and the e2e `injectGhostTracks` has to toggle it manually to force a frame.
- **Replay-mode worker gating not yet applied.** Frame sends stop in replay mode (`animateTracks` gates on `!this.replayMode`), but the worker `onmessage` handler is not replay-aware: an in-flight reply arriving after replay entry still overwrites `latestRenderingBuffer`/`liveTrackStateById`, worker EMCON/ghost clocks keep running on `performance.now()`, and no `RESET_STATE` is posted on replay entry/exit. Planned Phase-20 work.
- **`TrackManager` size and multi-responsibility.** 1864 lines spanning state ownership, five mesh families, boids, telemetry, provenance, UPF attention, recon overlays, replay restore, and scenario reset; highest-risk surface for regressions.
- smoke coverage is broader than v1 (9 specs + schema unit tests) but still targeted, not comprehensive; local non-browser checks remain syntax and bundle integrity, and the GitHub workflow does not yet run the unit or budget lanes.

## Acceptance Criteria

- architecture description matches current repo structure (all `src/core` modules, `main.js`, `shaders.js`, `mockData.js` enumerated with roles and line counts)
- replay, provenance, advisory logic, and automated proof paths are treated as first-class system components
- named capabilities that are stubs or heuristics ("V-JEPA", "AlphaEarth", `SigintFeed`) are labeled as such wherever they appear
- limitations on coverage depth, worker gating, render-path completeness, and runtime proof are called out explicitly with source-verifiable claims

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/main.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/trackSchema.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/MapEngine.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/scripts/check_bundle_budget.mjs`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/smoke.spec.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/unit/trackSchema.test.mjs`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/.github/workflows/verification.yml`
