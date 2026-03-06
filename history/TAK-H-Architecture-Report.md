# TAK-H.html Architecture Report

Here is a detailed, component-level breakdown of the `TAK-H.html` codebase. The architecture represents a highly interactive, single-file C2 (Command and Control) prototype combining a complex DOM-based HUD with a procedural WebGL environment.

### 1. **CSS and Styling Engine (Lines 1-788)**
*   **CSS Variables (Tokens)**: Foundational colors representing tactical environments (e.g., `--blue-force`, `--amber-alert`) and specific opacities are declared in `:root`.
*   **Theme Control**: 
    *   **Density Mapping**: Classes like `.compact-hud` dramatically reduce padding and font sizes across the UI to fit more data.
    *   **Accessibility Overrides**: High-contrast modes (`.high-contrast`) and reduced motion modes (`.reduced-motion`) modify the color bounds and kill CSS animation intervals.
*   **Visual FX**: Built-in visual flavor mapping out a CRT scanline filter (`#scanlines`) via repeating linear gradients, and radial gradients for screen vignettes.
*   **Grid Layout Setup**: The DOM fundamentally relies on a responsive `#hud` layer applying `display: grid` with highly structured columns (`#left-col`, `#top-bar`, `#bottom-bar`, `#right-col`) that automatically collapses on narrower viewports via media queries (`@media (max-width: 1100px)`).

### 2. **DOM / HTML Structure (Lines 790-1222)**
*   **Overlay Structure Elements**: Holds global overlays like the visual grid and the interactive targeting pipelines (`#confirm-strip` and `#undo-strip`).
*   **HUD Panels**: Every section on the UI utilizes a standardized `.panel` sub-architecture featuring a `.panel-header` and `.panel-body` storing repeated `.data-row` elements.
*   **Feature Areas**: 
    *   *SITREP & Controls* (Left column): Mission details, currently selected active track bindings, track logging tables, and HUD option toggles.
    *   *Context & Map Elements* (Top/Bottom Center): Realization of coordinates (MGRS format), Zulu clock tracking, the simulated SIGINT datalink feed, and the core operation/audit logging element (`#ops-log-panel`).
    *   *Sensor & Environmental Status* (Right column): Gimbal/Sensor states, SAM ranges, meteorological statuses, and fuel telemetry.

### 3. **Three.js Terrain and GLSL Shaders (Lines 1228-1498)**
*   **Initialization**: Configures a robust `WebGLRenderer` binding to `#canvas-container` running `ACESFilmicToneMapping` for realistic color output. The primary `PerspectiveCamera` observes the volume.
*   **Custom GLSL Shaders**: 
    *   The `mapFS` fragment shader is a massive function handling the procedural drawing of two map configurations utilizing advanced Domain-Warping over Fractional Brownian Motion (FBM) and Perlin noise.
    *   *Tactical View*: It calculates the presence of urban structures vs. roads vs. terrain, overlaying SAM ring warnings in a red tint.
    *   *Museum View*: Uses dynamic shadowing algorithms to represent an actual physical table-top map with creases and shadows.
    *   *Explosions*: Supports up to 8 real-time impact blasts using distance formulas to blend shockwave rings and crater scorching parameters based on a decay uniform loop.
*   **3D Extras**: Uses `overlayGroup` to assemble Three.js primitive classes mimicking standard C2 systems (Radar Sweep overlays using `CircleGeometry`, coordinate grids).

### 4. **Decoy Simulation System (Lines 1553-1810)**
*   An explicit simulation environment mimicking hostile electronic signatures.
*   Randomly fabricates mock signal IDs like `DJITEST-` concatenated to spoofed HEX mac addresses. 
*   Uses `setTimeout()` triggers inside `scheduleDecoyBurst()` to write mock RF broadcasts directly into the SIGINT panel, while tying that interaction status directly into the top right "DECOY SIM" HUD element. 

### 5. **Track (Entity) Configuration & Generation (Lines 1887-1988)**
*   Initializes an array representing tactical engagements with rigid subtypes (`TK-4071`, `BF-1002`, `UK-7001`).
*   Fabricates completely custom meshes utilizing `THREE.ShapeGeometry` based on allegiance: Hostile = Inverted Triangle, Friendly = Circle, Unknown = Diamond.
*   Assembles a full object-graph hierarchy per track adding:
    *   A massive invisible hitbox `CircleGeometry` masking to enable easier mouse clicking.
    *   Surrounding aesthetic `EdgesGeometry` brackets.
    *   Animated "Lock rings" and dynamic "destination lines".

### 6. **Control Workflows and Logic Handlers (Lines 1990-2343)**
*   **Selection State Manager (`selectTrack`)**: Fires across multiple event vectors bridging the 3D meshes to the DOM. It populates `.active-track-panel`, applies unique lock-ring materials to meshes, highlights the correct track-table row, and pipes a "SELECT" string into the Ops Log.
*   **UX Workflows via `Raycaster`**: Hooks `mousedown` and performs complex logic handling map vs. entity clicks.
    *   *Nothing selected*: Calculates explosion parameters onto the map using intersected vectors.
    *   *Track + Map Click*: Starts the **Designation Pipeline**. 
*   **Designation Pipeline**: Employs a state-machine driven event pattern (`pendingDesignationStage`).
    *   Stage 1: Validates target vector, forces the screen to pop up the reviewing pane.
    *   Stage 2: Checks reasoning variables.
    *   Stage 3: Submits the strike, spawns an explosion shader call, pipes the attack to the Ops Log, and fires an 8-second temporary `undoTimeoutId` to revoke the pipeline logic.
*   **Key Controls Handlers**: Comprehensive keyboard mappings using nested `switch/if` loops allowing iterative selection (Arrows), cancelling (Escape), and settings (H, M, D) without the mouse.

### 7. **Datalinks, Logging, and Timers (Lines 2345-2550)**
*   **Sigint Pipeline**: Uses an array of 15 hard-modeled scenario text drops. Bound by `scheduleSigintTick()`, this sequentially pushes data dynamically into the bottom HUD string format, honoring the current filtered tag state (e.g., WARN, INTEL).  
*   **Export Pipeline**: Handles JSON serialization on the master `opsLog` array via base64 encoded temporary `<a>` anchors upon clicking "Export Log".
*   **MGRS Calculation**: A rigid geographical mapping logic formatting standard floats into mock Military Grid Reference Systems layouts. 
*   **Time Loops**: Independently manages the Zulu clock layout formats bound natively to `setInterval` for constant 1-second refreshes. 

### 8. **The Animation Loop (Lines 2553-2643)**
*   Relies deeply on the `requestAnimationFrame(animate)` framework rendering 60 instances a second.
*   **Theme Lerping**: Performs `THREE.MathUtils.lerp` checks against the master `uSkinMode` variable allowing fluid alpha-transition blending when the user snaps between the map modes.
*   **Mesh Calculations**:
    *   Pushes tracks horizontally traversing coordinates using math formulas mapping to trigonometric sine/cosine intervals, to emulate natural vehicle drifts. 
    *   Fades lock rings dynamically using Sine-pulses modifying alpha channels.
*   **Camera Tracking**: Modulates the global perspective camera's coordinates with a slight, low-frequency oscillation bound by the `simTime` parameter. This perfectly replicates the slight mechanical stabilization wobble seen operating targeting camera gimbals on rotary or drone platforms.
