# Interface Control Document

- project: TAK-FLOW
- artifact: interface_control_doc_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Identify the major module interfaces that carry mission-relevant state.

## Interface Inventory

| Interface ID | Interface | Producer | Consumer | Purpose |
| --- | --- | --- | --- | --- |
| ICD-001 | track state buffer | `TrackManager` | render path, DOM bindings, replay | synchronize live and replayable entity state |
| ICD-002 | provenance and confidence state | `TrackManager` | `DOMController`, `OpsLog` | gate designation and display trust state |
| ICD-003 | replay snapshot payload | `ReplayCapture` | `ReplayPlayer`, `TrackManager`, `DOMController` | restore deterministic operator context |
| ICD-004 | swarm telemetry | `TrackManager` | `DOMController` | drive polarization, milling, cohesion, and advisories |
| ICD-005 | worker metadata payload | `opforWorker.js` | `TrackManager` | propagate hostile, ghost, and EMCON render data |
| ICD-006 | designation queue state | `Store.js` | `DOMController`, `ReplayCapture` | preserve pending and undo designation state |
| ICD-007 | AlphaEarth terrain tensor | main thread | `opforWorker.js`, shader path | influence terrain visuals and traversal logic |

## Interface Constraints

- replay snapshots must remain schema-stable enough for import and export restoration
- replay schema identifiers and exported filenames should align with TAK-FLOW, not legacy TAK-H naming
- provenance and confidence values must stay visible to the operator when designation logic depends on them
- worker payloads must not silently diverge from UI assumptions around confidence and EMCON state

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/opforWorker.js`
