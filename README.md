# TAK-G: Tactical Mosaic C2 Theater Simulator

## Overview
TAK-G is a high-fidelity, theater-level Command and Control (C2) visualization prototype. Designed with a brutalist, typography-driven aesthetic, the simulator explores "Decision Intelligence" workflows—focusing on how an operator manages high-density, multi-domain tracks (1,500+ entities) with varying levels of trust, provenance, and predictive threat analytics.

The prototype simulates a degraded electronic warfare environment where tracks are probabilistic, and the system actively highlights critical, time-sensitive events while suppressing generic intelligence noise.

## Tech Stack
The project is built emphasizing maximum runtime execution speed and minimal dependencies, utilizing a vanilla web architecture:
- **Core Visuals**: `Three.js` (WebGL rendering, InstancedMeshes for 60fps tracking of thousands of entities).
- **Architecture**: Vanilla ES6 JavaScript, structured into modular classes (`TrackManager`, `DOMController`, `MapEngine`, `OpsLog`).
- **Styling**: Vanilla CSS, utilizing native CSS variables, flexbox layouts, and custom animations. No external UI frameworks (e.g., React, Tailwind) are used.
- **Development Environment**: Standard local HTTP server; no complex build steps or transpilation pipelines required.

  
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

## Running Locally
1. Clone the repository.
2. Serve the root directory using any local web server (e.g., `python3 -m http.server 8080` or `npx serve`).
3. Navigate to `http://localhost:8080` (or `http://localhost:5500` if using Live Server) in any modern WebGL-compatible browser.

## Next Steps
- Exploring experimental AI/LLM integration to emulate automated opposing force (OPFOR) or blue-force autonomous agents.
- Further expansion of the Decoy Simulation tools.
- Enhancing Electronic Warfare (EW) UI elements for degraded sensor states.
