# Goal Description
Phase 18 focuses on creating a "self-explaining" console by introducing a "Recommended Actions" card. This card will bind existing panels together by providing actionable insights for both the currently selected track and the overall swarm state. It will also introduce an innovative counterfactual toggle (predicting the impact of an action) and a Trust Split Meter (Sensor, Model, Comms certainty).

## Proposed Changes

### UI / DOM Layer
#### [MODIFY] [index.html](file:///Users/taoconrad/Dev/Experiment/TAK-H/index.html)
- Add a new `div` container for the "Recommended Actions" card, positioned appropriately (likely near the Sitrep or Swarm Kinematics panels).
- Inside the card, create two main sections: `[ SELECTED TRACK ]` and `[ OVERALL SWARM STATE ]`.
- Add UI elements for the Trust Split Meter (three horizontal bars for Sensor, Model, and Comms).
- Add a "Counterfactual Toggle" button.
- Add CSS styling in `src/style.css` matching the `TOP SECRET // SI // TK // NOFORN` amber/cyan aesthetic.

### Application Logic Core
#### [MODIFY] [src/core/DOMController.js](file:///Users/taoconrad/Dev/Experiment/TAK-H/src/core/DOMController.js)
- Implement `updateRecommendedActions()` called during the main render loop.
- Extract data from the selected track (staleness, confidence, ROZ intersection) to populate the "Action", "Why", and "Expected Outcome" fields.
- Extract overall swarm data (polarization, milling, recent datalink severed events from `opsLog`) to populate the "Task MTI Sweep" recommendations.
- Implement the Trust Split Meter logic:
    - **Sensor Certainty**: High if track is recently updated, low if extrapolating.
    - **Model Certainty**: High if track follows predicted kinematics, low if jittering/evading.
    - **Comms Certainty**: High if `entityType < 2.0`, low if `entityType === 2.0` (EMCON).

#### [MODIFY] [src/core/TrackManager.js](file:///Users/taoconrad/Dev/Experiment/TAK-H/src/core/TrackManager.js)
- **Contributor Overlay**: Calculate which tracks deviate most from the swarm centroid velocity (to identify tracks driving milling/disorder). Expose a `top_contributors` array.
- Implement visualization: When the Counterfactual toggle is active, visually highlight the top 20 contributor tracks.
- **Counterfactual Engine**: Implement a basic predictive function `predictMillingDrop(targetTrack)` that mathematically estimates how resolving a high-uncertainty track will impact the overall `milling` calculation.

### Web Worker (Optional but recommended for heavy math)
#### [MODIFY] [src/core/opforWorker.js](file:///Users/taoconrad/Dev/Experiment/TAK-H/src/core/opforWorker.js)
- If necessary, offload the contributor sorting ($O(n \log n)$) to the worker to maintain 60FPS on the main thread, passing the top 20 IDs back in the `ui` metadata payload.

## Verification Plan
### Manual Verification
1. Select a track in EMCON state (datalink severed) and verify the "Recommended Actions" card suggests "RECON 30s".
2. Verify the Trust Split meter accurately reflects low Comms certainty for EMCON tracks and high Sensor certainty for newly spawned tracks.
3. Toggle the Counterfactual view and verify the UI highlights the top 20 tracks driving swarm disorder, and the predicted milling drop math updates correctly.
