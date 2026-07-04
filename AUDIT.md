# TAK-FLOW UI Audit — Phase 20 closeout (2026-07-03)

All six findings below are **REMEDIATED** with runnable evidence. Phase 20
(Deterministic Replay and Temporal State Restoration) is closed; the claims
sheet rows C-020/C-024/C-025 carry the durable evidence pointers.

## Track Log panel — MAJOR — REMEDIATED
**Finding:** Threat posture is visible, but the panel still privileges static tabular state over temporal shifts such as designation staging and replay transitions.
**Principle:** P2 — Make temporal change as legible as current state.
**Remediation applied (F1):** `DOMController.updateTrackTable` highlights the replay-selected row via `TrackManager.getRenderSelectedTrackId`, and `restoreSnapshot` refreshes the table + active-track panel per scrubbed frame; threat filtering semantics are preserved (the filter pipeline is applied on every rebuild).
**Evidence:** `tests/replay_panels.spec.js` (marker-frame selection highlight assertion).

## SWARM KINEMATICS panel — MAJOR — REMEDIATED
**Finding:** Current order-parameter values are visible, but there is no deterministic temporal record of onset/clear transitions for swarm fracture conditions.
**Principle:** P2 — Make temporal change as legible as current state.
**Remediation applied (F2):** 4 Hz ring snapshots carry `orderParams`; `DOMController.renderTelemetrySnapshot` restores them into the panel per frame.
**Evidence:** `tests/replay_panels.spec.js` asserts the panel text equals the scrubbed snapshot's order parameters.

## Recommended Actions panel — MAJOR — REMEDIATED
**Finding:** Advisory supersession is legible in the live UI, but there is no replay artifact proving when V-JEPA displaced generic guidance.
**Principle:** P5 — Audit everything.
**Remediation applied (F3):** replay events `V_JEPA_ONSET`, `V_JEPA_CLEAR`, `RECOMMENDED_ACTION_SUPERSESSION`, `3DGS_MACRO_EXECUTED` are captured and the panel state restores per frame. Note: the gate is a rule-based heuristic advisory (no learned model) — see architecture spec stub labeling.
**Evidence:** `tests/replay_panels.spec.js` (event-jump options + critical/stood-down panel states across frames).

## OpsLog panel — MAJOR — REMEDIATED
**Finding:** Live advisories and designations are logged, but no deterministic replay session exists to audit state transitions frame-by-frame after the fact.
**Principle:** P5 — Audit everything.
**Remediation applied (F4):** per-snapshot `opsLogDelta` capture with accumulated rebuild during playback (`DOMController.restoreSnapshot`); export/import round-trip is a standing lane.
**Evidence:** `tests/replay_panels.spec.js` (monotonic feed rebuild across forward steps), `tests/replay_roundtrip.spec.js` (TP-007).

## HUD Controls — MINOR — REMEDIATED
**Finding:** HUD controls are visually dense but do not currently expose replay transport without mixing replay state into the map.
**Principle:** P4 — The map stays uncluttered.
**Remediation applied (F5):** dedicated transport bar below the viewport (`#replay-transport-bar`) with scrub, speed, event-jump, and keyboard transport; never rendered into the 3D scene.
**Evidence:** `tests/replay_panels.spec.js` + `tests/smoke.spec.js` (transport visibility, event-jump, keyboard stepping).

## 3D viewport (EMCON decay, UPF cone, ghost-track visual separation) — MAJOR — REMEDIATED
**Finding:** Live uncertainty is encoded well, but there is no deterministic playback path for EMCON decay, UPF primary resolution, and counterfactual scan overlays.
**Principle:** P1 — Encode uncertainty visually. Never hide confidence, decay, or epistemic status.
**Remediation applied (F6):** snapshot re-synthesis now preserves ghost rows (entityType 0, negative ids), rebuilds ghost/EMCON metadata maps for identity resolution and hit-testing, re-synthesizes hostile-lane trackData rows (EMCON singles keep their visual), and restores UPF focus + V-JEPA gate + counterfactual state; live worker frames are dropped while `replayMode` is set (with `workerPending` cleared unconditionally, so the sim resumes on exit).
**Evidence:** `tests/replay_determinism.spec.js` (exact identity restoration per entity class, late-frame immunity, live-resume regression) — claim C-024.
