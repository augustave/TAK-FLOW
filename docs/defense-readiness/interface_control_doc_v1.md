# Interface Control Document

- project: TAK-FLOW
- artifact: interface_control_doc_v1
- version: v2
- owner: Tao Conrad
- last_updated: 2026-07-03
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: v2 is a code-grounded deepening pass (2026-07-03) — every field, constant, and message type below is transcribed from the source in this repo, not from design intent

## Objective

Identify the major module interfaces that carry mission-relevant state, and pin their exact wire formats so producers and consumers cannot silently diverge.

## Interface Inventory

| Interface ID | Interface | Producer | Consumer | Purpose |
| --- | --- | --- | --- | --- |
| ICD-001 | track state buffer | `TrackManager` | render path, DOM bindings, replay | synchronize live and replayable entity state |
| ICD-002 | provenance and confidence state | `TrackManager` | `DOMController`, `OpsLog` | gate designation and display trust state |
| ICD-003 | replay snapshot payload | `ReplayCapture` | `ReplayPlayer`, `TrackManager`, `DOMController` | restore deterministic operator context |
| ICD-004 | swarm telemetry | `TrackManager` | `DOMController` | drive polarization, milling, cohesion, and advisories |
| ICD-005 | worker render payload (render + ui + intents) | `opforWorker.js` | `TrackManager` | propagate hostile, centroid, EMCON, UUV, and ghost render data |
| ICD-006 | designation queue state | `Store.js` | `DOMController`, `ReplayCapture` | preserve pending and undo designation state |
| ICD-007 | AlphaEarth terrain tensor (synthetic stub) | `MapEngine` | shader path; `opforWorker.js` (declared, currently unfed — see §1) | procedural terrain visuals; dormant traversal-cost input |
| ICD-008 | worker input frame + control messages | `TrackManager`, `main.js`, e2e harness | `opforWorker.js` | drive the OPFOR simulation off the main thread |
| ICD-009 | `__TAK_FLOW_TEST__` automation contract | `src/main.js` (e2e gate) | Playwright specs | deterministic browser verification |

The five sections below transcribe the load-bearing formats. Shared constants live in `src/core/trackSchema.js` (60 lines, pure, node-unit-tested via `tests/unit/trackSchema.test.mjs`) — it is the single contract between worker, render path, and replay pipeline.

## 1. Worker Input Frame (ICD-008)

Producer: `TrackManager.sendStateToWorker`. Consumer: the frame branch of `opforWorker.js` `onmessage`.

Flat `Float32Array`, row stride 9 (`trackSchema.INPUT_ROW_STRIDE`), buffer transferred:

| slot | field | semantics (as coded) |
| --- | --- | --- |
| 0 | id | numeric id = `parseInt` of the digits in the track id (`'SW-1042'` → `1042`), `0` fallback; mapping retained in `numericTrackIdMap` for reverse resolution |
| 1 | allegiance | `1.0` hostile / `0.0` friendly / `2.0` everything else (unknown). Worker routes `1.0` → hostiles, `0.0` → friendlies, and **drops `2.0` rows** — unknown swarms receive no OPFOR behavior |
| 2, 3 | x, y | boid plane position |
| 4 | z | depth; driven by the UUV dive cycle (`0.0` otherwise) |
| 5, 6 | vx, vy | boid velocity (`0.0` when the track has no `vel`) |
| 7 | threat | `threat_level` mapping: HIGH `1.0` / MEDIUM `0.5` / LOW and all else `0.0` |
| 8 | subtypeCode | `XLUUV_ORCA` 10, `LUUV_SNAKEHEAD` 11, `MUUV_KNIFEFISH` 12, `SUUV_SANDSHARK` 13, all other subtypes 0. Worker treats 10–13 as UUV; `< 10` counts as a ground unit in terrain-cost logic |

Constraints transcribed from code:

- Only tracks with `isSwarm` (subtype `'UAS SWARM'` or one of the four UUV subtypes) are serialized. Non-swarm tracks never cross the worker boundary.
- Worker skips sentinel rows where `id === 0 && x === 0 && y === 0`.
- Message payload keys: `{ buffer, decoyActive, decoyBurstCount, decoyProfileId, decoyGhostProfile, alphaEarthBuffer? }`. `decoyActive = Boolean(store.decoySim.running)`, `decoyBurstCount = Number(store.decoySim.burstCount) || 0`; `decoyProfileId` / `decoyGhostProfile` carry the active RF decoy family (`{ confidenceRange, lifetimeMs, speed, spoofWindow { onMs, offMs } }`, null → worker defaults). The worker also accepts a bare `ArrayBuffer` as `e.data`.
- `alphaEarthBuffer` (optional) is defined as a copy (`aeBuffer.slice(0)`) of `mapEngine.alphaEarthData` — a **synthetic terrain-embedding stub** (see architecture spec). Honesty note: the fetch path reads `window.opsLogInstance.exportContext`, but `OpsLog` only defines `exportContextGetter`, so the key is never attached at runtime. The worker's `EvaluateAlphaEarthTerrainCost` node fails closed (`alphaEarthData` stays null) and the behavior tree falls through to plain flanking. The interface is documented here as declared; the feed is currently dead.
- Flow control: `workerPending` boolean — one frame in flight; `sendStateToWorker` returns early while set; cleared only by the render-payload reply (typed `TRACK_LOST` / `DIAGNOSTICS` replies return before clearing it).

## 2. Worker Render Buffer, UI Metadata, Intents (ICD-005 / ICD-001)

Per-frame reply: `postMessage({ render, intents, ui }, [render, intents])` — both buffers ownership-transferred.

`render`: flat `Float32Array`, row stride 10 (`trackSchema.RENDER_ROW_STRIDE`):

`[id, entityType, x, y, z, yaw, speed, radius, count, confidence]` — `yaw = atan2(vy, vx) + PI/2`.

`entityType` discriminator (`trackSchema.ENTITY_TYPE`, full table):

| code | name | produced when |
| --- | --- | --- |
| 0.0 | `SIGINT_GHOST` | decoy-burst ghost track; ids are negative (from −1 descending) |
| 1.0 | `SWARM_CENTROID` | > 15 hostiles in a 3×3 spatial-hash neighborhood (cell 2.5) with polarization > 0.85; row id = first clustered hostile's numeric id, string id `CENTROID-<id>` |
| 2.0 | `EMCON_SINGLE` | unclustered non-UUV hostile inside an EW zone (kinematic extrapolation row) |
| 3.0 | `UUV_SURFACED` | UUV (subtypeCode 10–13) with z ≥ −0.1, outside EW zones |
| 4.0 | `UUV_SUBMERGED` | UUV with z < −0.1 — always routed through the EMCON path |
| 5.0 | `HOSTILE_SINGLE` | unclustered non-UUV hostile in the clear |
| 6.0 | `EMCON_CENTROID` | centroid whose center lies inside an EW zone |

Predicate semantics (`trackSchema.js`): `isEmconType` = {2.0, 4.0, 6.0}; `isCentroidType` = {1.0, 6.0}; `isUuvType` = {3.0, 4.0}.

Mesh routing (`TrackManager.animateTracks`): EMCON-predicate rows → `emconMesh` (InstancedMesh cap 2000, per-instance `aConfidence` / `aFocusWeight` shader attributes); `UUV_SURFACED` → `uuvMesh` (cap 500); centroid-predicate rows → `centroidMesh` (cap 50); all remaining rows (`HOSTILE_SINGLE`, `SIGINT_GHOST`) → the hostile instanced mesh, whose `count` is set solely from these rows. Each row is also folded into `liveTrackStateById` as `{x, y, speed, radius, count, confidence, entityType}` keyed by resolved string id (`CENTROID-<n>`, ghost/EMCON metadata id, `numericTrackIdMap` hit, else `SW-<n>`).

`confidence` column carries: `threat` for confirmed rows; decayed EMCON confidence × radius fade for EMCON rows; ghost confidence 0.2–0.49 (or 1.0 while force-confirmed) for `SIGINT_GHOST`.

`ui` metadata object (structured clone, not transferred):

- `centroids`: `[{ id, count, radius, childIds }]` — drives `isHiddenByCentroid` suppression of member tracks and one-shot `[SWARM-CENTROID]` CRITICAL ops-log entries
- `emcon`: `[{ id ('CENTROID-<n>' | 'SW-<n>'), numericId, radius, confidence, x, y }]` — drives one-shot `[EW ALERT]` WARNING entries and id resolution for EMCON rows
- `ghosts`: `[{ id ('GHOST-<n>'), numericId (negative), profileId (RF family id or null), x, y, confidence }]`
- `pheromone`: `[{ x, y, level }]` — stigmergy grid cells with `|level| >= 0.05`, strongest-first, capped at 400; cell centers on the 2.5-unit spatial hash. Drives the HUD-toggled "HOSTILE ROUTE MEMORY (SIM)" heat overlay (`pheromoneOverlay` store key, default off; hidden in replay mode — snapshots do not carry the grid)

`intents`: flat `Float32Array`, stride 4 `[id, vx, vy, vz]` (`vz` always 0.0), one row per hostile; applied by `TrackManager.applyOpforIntents` as `desiredOpforVector` on hostile swarm boids.

## 3. Worker Control Messages (ICD-008 inbound, ICD-005 outbound)

Transcribed from `opforWorker.js` `onmessage` (typed branches all `return` before the frame path).

Inbound:

| type | payload | effect |
| --- | --- | --- |
| `FORCE_CONFIDENCE` | `{ id }` | `TK-<n>` normalized to `SW-<n>`; id held confirmed for `FORCED_CONFIDENCE_TTL_MS = 180000` (3 min). Confirmed tracks bypass EMCON masking; force-confirmed ghosts render confidence 1.0 |
| `SET_EW_ZONES` | `{ zones }` | sanitized list replaces `EW_ZONES`: each zone coerced to numbers, kept only if x/y/radius finite and radius > 0; non-array → empty list |
| `RESET_STATE` | — | clears `emconState`, `lostTrackNotified`, `ghostTracks`, `forcedConfidenceById`, `pheromoneGrid`; zeroes `lastDecoyBurstCount`; restores `DEFAULT_EW_ZONES = [{ x: 0, y: 0, radius: 10.0 }]`. Posted by `TrackManager.resetScenario` |
| `SYNC_ENV` | `{ targets, threats }` | sets `envFriendlyTargets` / `envSamZones` for pheromone deposition. Sent at 1 Hz from the `main.js` animate loop: `targets` = live friendly `{x, y}` positions; `threats` = hardcoded SAM-1 `(-15, 20, r15)` and SAM-2 `(30, -25, r35)` (matches the engagement-zones panel; distinct from `MapEngine`'s three shader SAM rings) |
| `DIAGNOSTICS` | — | replies with the diagnostics message below |

Outbound:

- `{ type: 'TRACK_LOST', id }` — emitted once per id (`lostTrackNotified` set), ids `CENTROID-<n>` / `SW-<n>`, when an EMCON track's confidence ≤ `EMCON_LOST_CONFIDENCE_THRESHOLD (0.05)` or its ghost radius > `EMCON_MAX_RADIUS_KM (20.0)`. `TrackManager.handleTrackLost` resolves `SW-<n>` back to the real track id via `numericTrackIdMap`, removes the track from scope, and writes a one-shot INFO ops-log entry.
- `{ type: 'DIAGNOSTICS', pheromoneCells, emconStates, ghostCount, centroidCount, hostiles, friendlies, ewZones }` — cached on the main thread as `trackManager.latestWorkerDiagnostics`.
- The per-frame render payload of §2.

EMCON/ghost constants (worker): confidence decay `0.01/s`; `MAX_VELOCITY 5.0` (centroid/single ghost-radius expansion `2.5 units/s` plus bank-angle shape warp; UUV ghost radius instead grows `0.5 + 0.001 × distance traveled`). Decoy ghosts: 1–3 spawned per `decoyBurstCount` increment while `decoyActive` **and the active family's spoof window is open** (`(elapsed since decoyActive) % (onMs + offMs) < onMs`; `onMs <= 0` or `offMs <= 0` → always open; bursts landing in an OFF phase are suppressed, not deferred). Family behavior comes from `decoyGhostProfile` (sanitized worker-side; defaults: confidence 0.2–0.49, lifetime 6–12 s, speed 12) and each ghost carries `profileId` from `decoyProfileId`. Confidence is hard-clamped at `GHOST_CONFIDENCE_CEILING = 0.499` — profiles cannot raise ghosts above the 0.5 zero-trust line (claim C-013 invariant). All ghosts are removed when the decoy sim stops; `RESET_STATE` restores the default family.

## 4. Replay Snapshot Schema (ICD-003)

From `src/core/ReplayCapture.js` and `trackSchema.js`.

- `SNAPSHOT_VERSION = 'tak-flow.replay.v2'`. Legacy import set `LEGACY_SNAPSHOT_VERSIONS = {'tak-flow.replay.v1', 'tak-h.replay.v1'}` — `importSession` rejects anything else, requires `ringBuffer` and `eventSnapshots` arrays, and for legacy versions runs `trackSchema.normalizeLegacyTrackState` over every snapshot: entityType 1.0 rows whose id lacks the `CENTROID-` prefix → 5.0 `HOSTILE_SINGLE`; entityType 2.0 rows with the `CENTROID-` prefix → 6.0 `EMCON_CENTROID`. Documented residual ambiguity: a v1 row where a misrouted single was recorded under a `CENTROID-` id cannot be distinguished from a real centroid and is left as a centroid.
- Capture cadence 250 ms (`CAPTURE_INTERVAL_MS`); ring buffer capped at `MAX_RING_BUFFER = 14400` snapshots (~60 min at 4 Hz). Ring and event capture are suppressed while `trackManager.replayMode` is set; each capture dispatches a `replay:capture-updated` window event.
- Snapshot fields (`ReplayCapture._buildSnapshot`):
  - `version`, `timestamp` (ms since session start)
  - `trackState[]` rows: `{ id, x, y, z, vx, vy, vz, confidence, domain, emconState, isSigint, rfProfile, entityType, radius, count, subtype }` — base tracks merged with worker-only rows (ghost/EMCON/centroid synthetics) from `liveTrackStateById`
  - `orderParams { polarization, milling, cohesion, activeCount }`
  - `vjepaGate { active, onset }` — state of the "V-JEPA" gate, which is a **rule-based heuristic advisory** (threshold on live swarm order parameters in `DOMController`; no learned model)
  - `ufpState { primaryId, coneAngleDeg (constant 0), candidates, active, coneX, coneY, radius, cursorX, cursorY, primaryConfidence, lastUpdatedMs }`
  - `opsLogDelta` — ops-log entries unseen by prior snapshots
  - `recommendedAction { active, type ('V-JEPA' | null), counterfactualBound }`
  - `counterfactualState { active, x, y, radius }`
  - `uiState { selectedTrackId, trainingPreset (armed instructor preset id or null), reconMode, destinationMode, pendingDesignation, pendingDesignationStage, undoDesignation { trackId, details, mgrs }, confirmVisible, undoVisible, vjepaHoverActive }`
  - `designationQueue` — pending/undo entries from `TrackManager.getDesignationQueueSnapshot`
  - `triggerEvent` — `null` for ring snapshots, event name for event snapshots
- Session envelope (`serializeSession`): `{ version, sessionId (crypto.randomUUID), startTimestamp, ringBuffer, eventSnapshots }`.
- Export filename grammar: `replay.tak-flow.<sessionId>.<startTimestamp>.json` (`getExportFilename`).
- Playback (`ReplayPlayer`): merges ring + event snapshots sorted by timestamp; play interval `250 / speed` ms, speeds {0.25, 0.5, 1, 2, 4}; legacy aliases honored on read (`VEJPA_ONSET` marker; `DOMController.restoreSnapshot` falls back from `vjepaGate` to the legacy `vejpaGate` key). Live state is snapshotted on replay entry and restored on close.

## 5. `__TAK_FLOW_TEST__` Automation Contract (ICD-009)

Gating (verified in `src/main.js`): the object is defined only when the `e2e` query parameter is **present** — `new URLSearchParams(window.location.search).has('e2e')`; specs use `/?e2e=1`. The same flag enables the `MapEngine` non-WebGL renderer fallback (`allowRendererFallback`).

All 26 methods currently defined (methods marked * were added in the 2026-07-03 hardening pass):

| method | semantics |
| --- | --- |
| `listTracks()` | visible (non-centroid-hidden) tracks as `{ id, type, subtype, confidenceScore, provenance }` |
| `selectTrack(trackId)` | drives `DOMController.selectTrack`; returns the id |
| `stageDesignation(trackId, mgrs?)` | runs the `canInitiateStrike` gate, stages the two-step confirm strip (LOW-confidence reason dropdown included), captures `DESIGNATION_INITIATE`; returns `{ ok, reason? , pendingDesignation? }` |
| `setReconMode(active)` | toggles store `reconMode`; returns the new value |
| `commitDesignation()` | `DOMController.commitDesignation()`; true on commit |
| `undoDesignation()` | revokes the last designation; returns true |
| `forceTelemetry(telemetry)` | installs `testTelemetryOverride` (polarization/milling/cohesion/activeCount/com) and re-runs update; returns `{ critical, telemetry }` where `critical` is the V-JEPA gate state |
| `clearTelemetryOverride()` | removes the override and re-runs update |
| `openReplay()` | opens the transport over the live capture; returns `isOpen` |
| `executeRecommendedAction()` | fires the V-JEPA wide-area recon macro; returns `{ counterfactualActive, replayEventOptions, latestLog }` |
| `closeReplay()` | exits replay and restores live state; returns `isOpen` |
| `captureReplayEvent(eventType)` | forces an event snapshot; returns it (null while in replay mode) |
| `getReplayExportMetadata()` | `{ filename, version, ringBufferLength, eventSnapshotLength }` from a serialized session |
| `getLiveTrackState(trackId)`* | structured clone of the `liveTrackStateById` row (`{x, y, speed, radius, count, confidence, entityType}`) or null |
| `importReplaySession(sessionJson)`* | accepts string or object; runs `ReplayCapture.importSession`; returns resulting buffer lengths |
| `getReplaySnapshot(index = 0, source = 'ring')`* | clone of the ring (`'ring'`) or event (`'event'`) snapshot at index, or null |
| `setEwZone(x, y, radius)`* | posts `SET_EW_ZONES` with a single zone; returns the zone |
| `injectGhostTracks(count, profileId?)`* | seeds store `decoySim` (running, `count` decoys, `burstCount + 1`; optional RF family id attaches that profile's `ghost` block) and forces one worker frame, temporarily bypassing `workerPending`; returns true |
| `canDesignate(trackId)`* | `DOMController.canInitiateStrike` (confidence ≥ 0.6 or recon override; failure side effect: strike-abort warning + log) |
| `getTrackConfidence(trackId)`* | `TrackManager.getTrackConfidenceScore` — live worker confidence when present, else provenance label score (HIGH 0.9 / MEDIUM 0.7 / LOW 0.35) |
| `setUuvDepthOverride(depth)`* | pins UUV `z` (the dive cycle is wall-clock driven); non-finite clears; returns the applied value |
| `requestWorkerDiagnostics()`* | clears the cached reply and posts `DIAGNOSTICS`; returns true |
| `getWorkerDiagnostics()`* | clone of the latest `DIAGNOSTICS` reply, or null (poll after requesting) |
| `getPaletteState()`* | `{ isHighContrast, tokens { redForce, blueForce, yellowUnknown }, palette { hostile, friendly, unknown } }` — CSS tokens vs 3D mesh hex |
| `setHighContrast(active)`* | sets store `isHighContrast`; returns the new value |
| `getUiState()` | selection, designation, recon, alert text, replay transport state, recommended-action badge/critical, counterfactual flag, ops-log clone |

Specs may still patch or extend the object at test time (e.g. `tests/ew_degradation.spec.js` wraps `listTracks` to merge `GHOST-` rows); this section is the contract `main.js` ships.

## Interface Constraints

- replay snapshots must remain schema-stable enough for import and export restoration; new fields must be additive and the legacy normalization path (`trackSchema.normalizeLegacyTrackState`) must keep accepting `tak-flow.replay.v1` / `tak-h.replay.v1`
- replay schema identifiers and exported filenames stay on TAK-FLOW naming (`tak-flow.replay.v2`, `replay.tak-flow.*.json`); legacy TAK-H imports remain read-only compatible
- provenance and confidence values must stay visible to the operator when designation logic depends on them (`canInitiateStrike` gate at confidence ≥ 0.6, recon override excepted)
- worker payloads must not silently diverge from UI assumptions around confidence and EMCON state — `src/core/trackSchema.js` is the single shared contract and is unit-tested; changes land there first
- allegiance `2.0` (unknown) rows are dropped by the worker; senders must not assume unknown swarms receive OPFOR behavior
- `alphaEarthBuffer` is declared but not populated at runtime (`exportContext` vs `exportContextGetter` mismatch in `sendStateToWorker`); consumers must treat worker terrain-cost steering as dormant until the feed is repaired

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/trackSchema.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/main.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/unit/trackSchema.test.mjs`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/tests/ew_degradation.spec.js`
