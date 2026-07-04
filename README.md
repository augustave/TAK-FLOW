# TAK-FLOW: Tactical Mosaic C2 Theater Simulator

## Overview
TAK-FLOW is a high-fidelity, theater-level Command and Control (C2) visualization prototype. Designed with a brutalist, typography-driven aesthetic, the simulator explores "Decision Intelligence" workflows—focusing on how an operator manages high-density, multi-domain tracks (1,500+ entities) with varying levels of trust, provenance, and predictive threat analytics.

The prototype simulates a degraded electronic warfare environment where tracks are probabilistic, and the system actively highlights critical, time-sensitive events while suppressing generic intelligence noise. The current build includes EMCON confidence-driven alpha decay, automatic lost-track culling, and zero-trust SIGINT ghost tracks.

## Tech Stack
The project is built emphasizing maximum runtime execution speed and minimal dependencies, utilizing a lightweight Vite + vanilla web architecture:
- **Core Visuals**: `Three.js` (WebGL rendering, InstancedMeshes for 60fps tracking of thousands of entities).
- **Architecture**: Vanilla ES modules, structured into modular classes (`TrackManager`, `DOMController`, `MapEngine`, `OpsLog`).
- **Styling**: Vanilla CSS, utilizing native CSS variables, flexbox layouts, and custom animations. No external UI frameworks (e.g., React, Tailwind) are used.
- **Development Environment**: `Vite` for local development/build, with static hosting of built assets for deployment.

  
<img width="1724" height="958" alt="Screenshot 2026-02-25 at 9 25 35 PM" src="https://github.com/user-attachments/assets/00f86624-a3b9-40ec-b9f3-766baabfaad0" />

  
## Core Intentions
1. **Decision Intelligence**: Move beyond passive maps. The UI acts as a filter, shifting operator focus to high-threat assets with a low time-to-event horizon (TTE < 60s) via visual pulsing and priority alert sorting.
2. **Dynamical Regimes over Scripting**: Swarms and hostiles aren't run on rails. The simulation uses organic, mathematical kinematic engines (Boids, Topological Interactions) to create unpredictable, lifelike emergent behaviors.
3. **Data Provenance**: Every track retains metadata regarding source trust, sensor age, and probabilistic confidence. 
4. **Information Density without Clutter**: The layout embraces a brutalist, grid-based aesthetic that packs intense data density into readable UI panels, keeping the 3D map uncluttered.

## Evolution of the Application

### Phases 1-7: The Foundation
*   **Architecture**: Initiated as a monolithic architecture, later refactored into a scalable modular system (`src/core/`).
*   **Rendering**: Implemented Three.js and a massive topological map mesh with animated scanlines. Used `InstancedMesh` to render 1,500 simultaneous multi-domain tracks (Friendly, Hostile, Unknown) without dropping frames.
*   **UI/UX**: Bootstrapped the brutalist side-panels: Track Log, Ops Log, SITREP, and HUD Controls.

### Phases 8-10: AI, Kinematics, & C2 Workflows
*   **Swarm Kinematics**: Implemented a metric-based Boids algorithm to control UAS swarm movements (Align, Cohese, Separate).
*   **Target Designation**: Built an interactive targeting workflow. Operators can select tracks, map destination coordinates, and execute strikes with an "Undo" window and Ops Log auditing.
*   **Decision Intelligence**: Integrated `threat_level` and `time_to_event` attributes. High-threat tracks dynamically trigger visual UI flashes and prioritize themselves in the Ops Log over generic intelligence feeds.
*   **Instructor Tools**: Added dynamic scenario loading (e.g., "MASSED SWARM", "STANDARD PATROL") to instantly inject specific kinematic tests into the theater.
*   **3DGS Recon**: Added a simulated Splat overlay ("3DGS") that zooms the camera and renders a point-cloud-style bounding box around specific locked targets.

### Phases 11-12: Biological Flight Mechanics & Dynamical Validation
*   **STARFLAG Topological Cohesion**: Replaced the traditional metric radius Boids engine with K-Nearest Neighbor (KNN/K=7) topological linking. Swarms now behave like starling murmurations, exhibiting extreme cohesive density spanning across map sectors without fracturing.
*   **Fuzzy Logic**: Injected simulated sensory noise variance into the flight vectors, giving the swarms chaotic, biological flight properties.
*   **Dynamical System Harness**: Built a real-time math engine into the `TrackManager` that calculates systemic **Order Parameters** (Polarization, Milling, Cohesion).
*   **Telemetry HUD**: Wired the Order Parameters into a live `SWARM KINEMATICS` UI panel, confirming through hard math that the biological swarms are undergoing actual regime changes and phase transitions, not just moving organically. 

### Phases 13-14.3: OPFOR Worker, EMCON Decay, & Zero-Trust Guardrails
*   **OPFOR Worker Pipeline**: Introduced a dedicated `opforWorker.js` execution lane for hostile swarm behavior-tree intents, centroiding, and EW-state render metadata.
*   **EMCON Alpha-Decay**: EMCON heatmaps now ingest per-instance confidence (`aConfidence`) in shader space and scale fragment alpha accordingly, with a hard cap of `0.6` to prevent full-screen visual occlusion.
*   **Radius/Confidence Culling**: Lost tracks are automatically culled when confidence decays to `<= 0.05` or EW extrapolation radius exceeds `20km`; culled tracks are removed from active buffers and recorded in Ops Log.
*   **Zero-Trust SIGINT Ghosts**: Decoy simulation bursts can now inject synthetic low-confidence (`<0.5`) ghost tracks with non-kinematic jumps to emulate spoofed emissions.
*   **Designation Guardrails**: Strike designation is blocked for tracks under `0.6` confidence unless the operator explicitly overrides through `RECON [3DGS]`, with amber warning feedback and audit logging.

### Phase 18: Red-Team Predictive Guardrails
*   **V-JEPA Anxiety Warning Gate**: `DOMController` now evaluates `swarmTelemetry` in real-time and raises a high-priority amber advisory when `(cohesion <= 0.05 && milling >= 0.40 && activeCount > 100)`.
*   **Recommended Actions Panel**: Added a dedicated panel that escalates the V-JEPA warning over generic decoy guidance to prevent operator complacency during EW-driven swarm fractures.
*   **3DGS Counterfactual Binding**: Hovering the critical recommendation projects an expanding ring overlay over the swarm telemetry anchor; clicking `[EXECUTE]` instantly drops a wide-area `RECON [3DGS]` macro splat.
*   **Exported Telemetry Expansion**: Telemetry reports now include recommended-action state and counterfactual overlay runtime fields, improving after-action traceability.

### Phase 19: Uncertain Pointer Framework (UPF)
*   **Spatial Selection Cone**: Mouse hover now projects a localized cone on the map and evaluates nearby active tracks using squared-distance checks for low-overhead clustering.
*   **Primary Target Resolution**: Captured cone candidates are ranked by live confidence, and the highest-confidence candidate is promoted to primary focus.
*   **Identity & Level Design**: Non-primary cone captures are dampened, while the primary target receives an amber pulsing hex-bracket plus a glowing pointer-to-target guide line.
*   **Feedforward Auto-Select**: Clicking loosely inside the cone now resolves to the primary target without requiring pixel-perfect raycast hits.

### Phase 20: Deterministic Replay & Temporal State Restoration (closed 2026-07-03)
*   **Entity Identity Contract**: `src/core/trackSchema.js` gives every entity class a unique render code shared by the worker, the render path, and replay (fixing the historical entityType collisions); replay schema bumped to `tak-flow.replay.v2` with lossless legacy import.
*   **Deterministic Viewport Restoration**: scrubbed frames restore exact identities/confidences for ghosts, EMCON tracks, centroids, and singles; live worker frames are gated out during replay.
*   **Panel Fidelity**: Track Log selection, kinematics order parameters, advisory lifecycle, and accumulated ops-log deltas restore frame-by-frame; all six UI-audit findings remediated with test pointers (`AUDIT.md`).
*   **Ghost RF Families + Training Presets**: decoy profiles carry per-family confidence/lifetime/spoof-window behavior (zero-trust ceiling enforced worker-side); instructor presets arm scenario + EW lay-down + decoy family in one action.
*   **Route-Memory Overlay**: the worker's stigmergy grid is now a toggleable heat layer (`ROUTE MEMORY (SIM)`), cyan for validated hostile routes, red-orange for SAM denial traces.

## Running Locally
1. Clone the repository.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.
4. Open the local Vite URL shown in the terminal in a modern WebGL-compatible browser.

## Canonical Mission Demo
- Open the app with `?demo=1` to boot straight into the shipped canonical mission replay (`public/demo/replay.tak-flow.canonical-mission-01.json`) — a GHOST-DISCRIMINATION drill with ghost designation refusal, an EW squall, an advisory onset + 3DGS macro, and a designation/undo cycle, scrubbable in the replay transport.
- Re-record it after replay-affecting changes with `npm run record:demo`.
- Verify a deployment serves the real client with `node scripts/check-deploy.mjs <url>` (the repo auto-deploys pushes via the Vercel GitHub integration).

## Production Build
1. Run `npm run build`.
2. Serve the generated `dist/` directory with any static web server.

## Verified Claims
Every capability statement above traces to a runnable evidence pointer in [docs/defense-readiness/validated_claims_sheet_v1.md](docs/defense-readiness/validated_claims_sheet_v1.md) (C-001…C-026): EMCON decay & culling (C-012, `npm run test:ew`), ghost isolation (C-013), entity identity (C-016), executable CONOPS mission (C-020, `tests/conops_mission.spec.js`), deterministic replay (C-024/C-025), route-memory overlay (C-026), and more. The full lane runs with `npm run ci:verify`. Honesty notes: the "V-JEPA" gate is a rule-based heuristic (no learned model), "AlphaEarth" terrain data is a synthetic stub, and C-009 (operational deployment readiness) is explicitly **Rejected** — TAK-FLOW is a prototype/simulation.

## Next Steps
- Repair the dormant AlphaEarth worker feed (`exportContext` accessor mismatch — see the ICD constraint note) and cover terrain-cost steering with a behavior assertion.
- Token-govern the shader-side EMCON/ghost confidence colors and the route-memory overlay ramps.
- Build an in-repo harness for the report-only figures (10k ghost burst, advisory latency) cited by C-013/C-014.
