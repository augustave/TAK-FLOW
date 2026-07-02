# Visual Token Manifest

- project: TAK-FLOW
- artifact: visual_token_manifest_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-02
- status: draft

## Objective

Provide a single authoritative inventory of every semantic visual token (colors, shapes, thresholds, event names, identity strings) with its code source, consumers, and consistency status — so cross-context drift between the 3D viewport, DOM panels, replay artifacts, and documentation is auditable rather than accidental.

## Authority Model

- Color authority: CSS custom properties in `src/style.css` (`:root` and `body.high-contrast` blocks). The 3D palette follows CSS via `TrackManager.syncPaletteFromCss()`, re-synced on every `isHighContrast` store transition (wired in `src/main.js`).
- Threshold authority: named constants in code (see Threshold Tokens). Docs restate them; on conflict, code wins and docs must be corrected.
- Identity authority: `SNAPSHOT_VERSION` exported from `src/core/ReplayCapture.js`; `ReplayPlayer` imports it rather than redeclaring.

## Color Tokens

| Token | Base | High-Contrast | CSS Source | 3D Consumer | Meaning |
| --- | --- | --- | --- | --- | --- |
| `--red-force` | `#ff3333` | `#ff6a6a` | `src/style.css` | `TrackManager.typeColors.hostile` | hostile track |
| `--blue-force` | `#4a9eff` | `#7bc6ff` | `src/style.css` | `TrackManager.typeColors.friendly` | friendly track |
| `--yellow-unknown` | `#ffcc00` | `#ffe066` | `src/style.css` | `TrackManager.typeColors.unknown` | unknown track |
| `--amber-alert` | `#ff8800` | `#ffb04a` | `src/style.css` | replay V-JEPA marker (`.marker-vjepa`) | advisory / caution |
| `--cyan-data` | `#00ddff` | `#82f7ff` | `src/style.css` | DOM panels only | data / telemetry accent |
| `--green-neutral` | `#33cc66` | (no remap) | `src/style.css` | DOM panels only | nominal state |

Verified 2026-07-02 via live browser eval: 3D `typeColors` and instance material colors follow CSS values through a high-contrast on/off round trip.

## Shape Tokens

Track type is dual-encoded (shape + color) so identity survives the archival-skin grayscale film pass.

| Type | Shape | Source |
| --- | --- | --- |
| hostile | diamond with tail | `TrackManager` constructor `ShapeGeometry` |
| friendly | circle with tail | `TrackManager` constructor `ShapeGeometry` |
| unknown | hex-square with tail | `TrackManager` constructor `ShapeGeometry` |

Note: symbology is custom, not MIL-STD-2525. Acceptable for a prototype; flag before any fielding claim.

## Threshold Tokens

| Token | Value | Code Source | Doc References |
| --- | --- | --- | --- |
| strike-designation confidence gate | `>= 0.6` (or RECON override) | `DOMController.canInitiateStrike` | `README.md` Phases 13–14.3 |
| EMCON lost-track cull confidence | `<= 0.05` | `opforWorker.js` `EMCON_LOST_CONFIDENCE_THRESHOLD` | `README.md` |
| EMCON lost-track cull radius | `> 20.0 km` | `opforWorker.js` `EMCON_MAX_RADIUS_KM` | `README.md` |
| V-JEPA anxiety gate | `cohesion <= 0.05 && milling >= 0.40 && activeCount > 100` | `DOMController.isVjepaThreatAnxietyCondition` | `README.md` Phase 18 |
| ghost-track confidence ceiling | `< 0.5` | `opforWorker.js` ghost spawn | `README.md` |
| kinematics badge: MILLING | `milling > 0.6` | `DOMController.update` | not documented in README |
| kinematics badge: ALIGNED | `polarization > 0.7` | `DOMController.update` | not documented in README |
| kinematics badge: CLUSTERED | `cohesion > 0.8` | `DOMController.update` | not documented in README |

## Replay Event Tokens

| Token | Emitter | Notes |
| --- | --- | --- |
| `V_JEPA_ONSET` | `DOMController.updateRecommendedActions` | canonical since 2026-07-02; legacy `VEJPA_ONSET` still recognized by the replay marker renderer for old exports |
| `V_JEPA_CLEAR` | `DOMController.updateRecommendedActions` | canonical since 2026-07-02; legacy spelling `VEJPA_CLEAR` may appear in old exports |
| `RECOMMENDED_ACTION_SUPERSESSION` | `DOMController.updateRecommendedActions` | |
| `DESIGNATION_INITIATE` | `src/main.js`, e2e harness | |
| `DESIGNATION_CANCEL` | `src/main.js` keyboard path | |
| `DESIGNATION_CONFIRM` | designation commit path | styled scrub marker `.marker-designation` |
| `SMOKE_MARKER` | test-only (`tests/smoke.spec.js`) | never emitted in production paths |

Snapshot schema field: `vjepaGate` (canonical since 2026-07-02). Restore paths in `DOMController` accept legacy field `vejpaGate` from older exports.

## Identity Tokens

| Token | Value | Source |
| --- | --- | --- |
| replay schema version | `tak-flow.replay.v1` | `ReplayCapture.js` `SNAPSHOT_VERSION` (exported; imported by `ReplayPlayer.js`) |
| accepted legacy versions | `tak-h.replay.v1` | `ReplayCapture.js` `LEGACY_SNAPSHOT_VERSIONS` (import-only) |
| replay export filename | `replay.tak-flow.<sessionId>.<startTimestamp>.json` | `ReplayCapture.getExportFilename` |
| telemetry report type | `TAK-FLOW TELEMETRY REPORT` | `OpsLog.buildTelemetryReport` |
| telemetry export filename | `TAK_TELEMETRY_REPORT_<iso>.json` | `OpsLog.js` download anchor |

## Known Gaps

- Kinematics badge thresholds (0.6 / 0.7 / 0.8) exist only in code; no doc restates them (this manifest is now the reference).
- `tests/ew_degradation.spec.js` EMCON culling test selects a nondeterministic track and fails intermittently (observed failing 2026-07-02 on both pre- and post-change trees). Needs deterministic EW-zone track pinning.
- `validated_claims_sheet_v1` C-012 referenced an `npm run test:ew` script that does not exist in `package.json`.
- EMCON/ghost shader-side confidence colors and decoy overlays are not yet token-governed; they remain hardcoded in worker/shader paths.

## Evidence Links

- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/style.css`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/ReplayPlayer.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/OpsLog.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/core/opforWorker.js`
- `/Users/taoconrad/Dev/GitHub 4/TAK-FLOW/src/main.js`
