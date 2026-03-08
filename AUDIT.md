## Track Log panel — MAJOR
**Finding:** Threat posture is visible, but the panel still privileges static tabular state over temporal shifts such as designation staging and replay transitions.
**Principle:** P2 — Make temporal change as legible as current state.
**Remediation:** Add replay-aware state restoration for the Track Log selection context and preserve threat filtering semantics during replay without introducing new map clutter.
**Blocking:** Phase 20

## SWARM KINEMATICS panel — MAJOR
**Finding:** Current order-parameter values are visible, but there is no deterministic temporal record of onset/clear transitions for swarm fracture conditions.
**Principle:** P2 — Make temporal change as legible as current state.
**Remediation:** Capture 4 Hz replay snapshots with order parameters and restore those values into the panel during playback.
**Blocking:** Phase 20

## Recommended Actions panel — MAJOR
**Finding:** Advisory supersession is legible in the live UI, but there is no replay artifact proving when V-JEPA displaced generic guidance.
**Principle:** P5 — Audit everything.
**Remediation:** Emit replay event captures for V-JEPA onset, clear, supersession, and 3DGS macro execution, then restore the panel state during playback.
**Blocking:** Phase 20

## OpsLog panel — MAJOR
**Finding:** Live advisories and designations are logged, but no deterministic replay session exists to audit state transitions frame-by-frame after the fact.
**Principle:** P5 — Audit everything.
**Remediation:** Add replay capture export/import and playback log restoration based on per-snapshot OpsLog deltas.
**Blocking:** Phase 20

## HUD Controls — MINOR
**Finding:** HUD controls are visually dense but do not currently expose replay transport without mixing replay state into the map.
**Principle:** P4 — The map stays uncluttered.
**Remediation:** Add a dedicated replay transport bar below the viewport, styled consistently with the HUD, and keep it out of the 3D scene.
**Blocking:** Phase 20

## 3D viewport (EMCON decay, UPF cone, ghost-track visual separation) — MAJOR
**Finding:** Live uncertainty is encoded well, but there is no deterministic playback path for EMCON decay, UPF primary resolution, and counterfactual scan overlays.
**Principle:** P1 — Encode uncertainty visually. Never hide confidence, decay, or epistemic status.
**Remediation:** Restore snapshot-driven live-track state, UPF focus, V-JEPA gate state, and synthetic-track confidence during replay without adding new viewport artifacts.
**Blocking:** Phase 20
