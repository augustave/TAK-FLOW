# UI Layout Contract

- project: TAK-FLOW
- artifact: ui_layout_contract_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-04
- status: reviewed
- note: Zone/z-index/typography contract for the C2 interface. Structure follows the "Topological Containment Framework" spec pattern; **values are transcribed from the live implementation** (`src/style.css`, `index.html`), not from the idealized spec. Where the spec and the code diverged, the code's (more mature) choice is authoritative — see the reconciliation notes.

## Objective

Pin the spatial rules, layer order, palette, and typography so incoming spatial/telemetry data can never break or resize the interface, and so any agent inherits the aesthetic boundaries before writing UI code.

## Aesthetic

Scientific brutalism: monospaced tabular typography, uppercase labels, glass-over-topology panels anchored to the screen edges, a solid classification boundary top and bottom, and semantic color reserved for trust/threat state.

## Layer Architecture (z-stack)

The interface is a fixed set of full-viewport layers; the map owns the base and never resizes. All z-index values from `src/style.css`.

| Layer | Element | z-index | Behavior |
| --- | --- | --- | --- |
| Active topology | `#canvas-container` (Three.js) | 1 | Full-bleed 3D map + tracks. Owns all spatial rendering; never resized by UI. |
| Main HUD | `#hud` | 10 | CSS-grid panel frame (see below). `pointer-events: none` so clicks pass through the gaps to the map. |
| Vignette | `#vignette` | 14 | Radial darkening at edges; `pointer-events: none`. |
| CRT scanlines | `#scanlines` | 15 | Atmosphere; `pointer-events: none`. |
| Drawer toggles | `.drawer-toggle` | 17 | Left/right panel collapse controls. |
| Classification banners | `.classification-banner.top/.bottom` | 20 | Solid amber boundary frames (see Meta-frames). |
| Replay transport | `#replay-transport-bar` | 35 | Below-viewport transport; off the 3D scene (AUDIT P4). |
| Modals / alerts | designation strips, alert overlays | 50 | Topmost; transient. |

Because each concern is on its own layer, panels float cleanly over the map without squishing it, and telemetry volume changes never reflow the chrome.

## Zone Layout (the HUD grid)

`#hud` is a **CSS grid**, not absolute-positioned blocks — grid handles gaps and overflow without crash-stacking, and the `pointer-events` split keeps the map interactive through the panel gutters.

```
#hud {
  position: absolute;
  top: 28px; left: 0;            /* clears the top classification banner */
  width: 100%;
  height: calc(100% - 56px);     /* clears top + bottom banners (28px each) */
  z-index: 10;
  pointer-events: none;          /* map stays clickable through gaps */
  display: grid;
  grid-template-columns: 280px 1fr 260px;   /* left ledger | map gutter | right command */
  grid-template-rows: auto 1fr auto;
  padding: 8px;
}
.panel { pointer-events: auto; }  /* panels capture, gutters pass through */
```

| Zone | Grid region | Width | Contents |
| --- | --- | --- | --- |
| Left ledger (ingestion) | column 1 | 280px | SITREP, TRACK LOG, COMMS, HUD CONTROLS |
| Center gutter | column 2 (`1fr`) | fluid | transparent; map shows through, cursor/target readouts anchored bottom |
| Right command (deterministic) | column 3 | 260px | ALPHAEARTH, SENSOR PKG, ENG ZONES, SWARM KINEMATICS, RECOMMENDED ACTIONS |

Responsive: `@media (max-width: 1100px)` collapses the fixed columns; drawer toggles (`#left-drawer-toggle`, `#right-drawer-toggle`) hide/show the ledgers.

## Meta-frames (classification boundary)

`.classification-banner` — solid `--classification (#ffcc00)` amber fill, black text, JetBrains Mono 11px, letter-spacing 3px, **28px** tall, z-index 20. `.top { top: 0 }` / `.bottom { bottom: 0 }`. These are the global visual state frame: `TOP SECRET // SI // TK // NOFORN`.

## Palette (`:root` in `src/style.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--red-force` | `#ff3333` | hostile / kinetic threat / override |
| `--blue-force` | `#4a9eff` | friendly force |
| `--yellow-unknown` / `--classification` | `#ffcc00` | unknown track / classification + boundary amber |
| `--green-neutral` | `#33cc66` | nominal / neutral |
| `--amber-alert` | `#ff8800` | caution / degraded |
| `--cyan-data` | `#00ddff` | UUV / data-lane (reserved — do not reuse for friendly) |
| `--text-primary` | `#d0dae8` | primary text (soft blue-white, not pure white — lower eye-strain) |
| `--text-dim` | `#5a7090` | de-emphasized text (blue-tinted; passes contrast) |
| `--text-label` | `#8099b8` | panel labels |
| `--bg-panel` | `rgba(8,12,18,0.88)` | glass panel fill (with `backdrop-filter: blur(6px)`) |
| base void | `#030608` | body background (cool near-black) |

High-contrast accessibility mode (`body.high-contrast`) overrides these tokens (see `visual_token_manifest_v1.md`); the 3D palette follows via `TrackManager.syncPaletteFromCss` (claim C-015).

## Typography

- Family: `'JetBrains Mono', 'Share Tech Mono', monospace` (real tabular figures, strong hinting).
- **`font-variant-numeric: tabular-nums`** on `body, html` — structural, not decorative: data columns lock to a fixed grid so rapid numeric updates stay column-aligned (rigid-spreadsheet readability). Added 2026-07-04.
- `text-transform: uppercase` on labels/titles.
- **Contract rule:** numeric telemetry must be rounded/fixed before render — no raw floats in data cells. Enforced at `DOMController` (SPD `Math.round`, BRG `toFixed(0).padStart(3,'0')`, RNG `toFixed(1)`).

## Reconciliation notes (vs the "Topological Containment Framework" spec)

Rejected spec choices that would regress this contract: cyan `#00CCCC` for friendly (collides with reserved `--cyan-data`), pure-white `#FFFFFF` text and `#555` dim (fails contrast on near-black), `position: absolute` magnet layout (CSS grid + pointer-through is more robust), 40px meta-frames and 320/380px zone widths (cosmetic drift; the spec's own YAML and HTML disagreed at 300/350 vs 320/380). Adopted spec principle: tabular-nums as a structural mechanism — which surfaced and fixed a real raw-float defect in the SPD column.

## Evidence Links

- `src/style.css`
- `index.html`
- `src/core/DOMController.js`
- `src/core/TrackManager.js` (`syncPaletteFromCss`)
- `docs/defense-readiness/visual_token_manifest_v1.md`
