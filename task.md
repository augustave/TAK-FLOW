# Phase 18: Recommended Actions & Counterfactuals

- [ ] `index.html` & `style.css`: UI Layout
    - [ ] Create the "Recommended Actions" card HTML structure.
    - [ ] Add Trust Split Meter (Sensor, Model, Comms) UI.
    - [ ] Adhere to the amber/cyan cyber-tactical aesthetic.
- [ ] `DOMController.js`: Data Binding
    - [ ] Implement `updateRecommendedActions(selectedTrack, swarmState)`.
    - [ ] Populate "Selected Track" recommendations (Action, Why, Expected).
    - [ ] Populate "Overall Swarm" recommendations based on global state.
    - [ ] Bind real data to the Trust Split Meter.
- [ ] `TrackManager.js` & `opforWorker.js`: Contributor & Counterfactual Engine
    - [ ] Calculate track variance from centroid (Milling/Disorder contributors).
    - [ ] Implement `predictMillingDrop()` math function.
    - [ ] Add visual highlights to the 3D scene for "Top 20 Contributors" when counterfactual mode is toggled.
