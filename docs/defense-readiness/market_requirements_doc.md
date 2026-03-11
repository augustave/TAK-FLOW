# Market Requirements Document

- project: TAK-FLOW
- artifact: market_requirements_doc
- version: v1
- owner: Tao Conrad
- last_updated: 2026-03-11
- status: working-draft

## Objective

Define the defense-adjacent problem TAK-FLOW is solving today and bound the claims to what the repository can currently support.

## Problem Statement

Operators in dense, degraded, multi-domain theaters need interfaces that surface uncertainty, provenance, and swarm-state changes without collapsing into map clutter. TAK-FLOW addresses that need as a simulation-first C2 visualization prototype, not as a fielded command system.

## Intended Users

- operators evaluating high-density track cognition workflows
- design engineers exploring trust-first C2 interfaces
- autonomy researchers studying swarm-state visualization and provenance signaling
- portfolio reviewers assessing high-assurance interaction design in defense-adjacent systems

## Required Outcomes

| Requirement ID | Requirement | Priority | Evidence Basis |
| --- | --- | --- | --- |
| MRD-001 | The system must visualize large mixed track populations without collapsing runtime responsiveness. | High | `README.md`, `src/core/TrackManager.js` |
| MRD-002 | The system must encode uncertainty, provenance, and confidence directly in the operator interface. | High | `README.md`, `src/core/DOMController.js`, `src/core/TrackManager.js` |
| MRD-003 | The system must support replayable audit context for key advisory and designation actions. | High | `src/core/ReplayCapture.js`, `src/core/ReplayPlayer.js`, `src/core/OpsLog.js` |
| MRD-004 | The system must keep the map visually subordinate to decision support and recommendation workflows. | High | `README.md`, `index.html`, `src/style.css` |
| MRD-005 | The project should provide executable local verification for build and code-integrity lanes. | Medium | `package.json` |
| MRD-006 | The project should add stronger automated runtime evidence for browser workflows and scenario behavior. | Medium | current repo state |

## Current Fit Assessment

- verified fit: theater-level C2 visualization, provenance-aware interaction design, replay/audit-oriented architecture, local build and code checks
- strong signal: EMCON decay, zero-trust ghost tracks, V-JEPA advisory gating, designation guardrails, and replay capture are all present in source
- gap: no browser-level scenario automation for designation, replay transport, or advisory supersession
- gap: repo identity still shows historical naming/upstream remnants, which weakens packaging clarity

## Acceptance Criteria

- the repo is clearly framed as a simulation/C2 prototype, not an operational battle-management product
- verified evidence supports build integrity and code-level feature presence
- missing runtime or CI proof is stated explicitly rather than implied away

## Evidence Links

- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/README.md`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/package.json`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/DOMController.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/TrackManager.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayCapture.js`
- `/Users/taoconrad/Dev/Experiment/FELLOWSHIP /TAK-FLOW/src/core/ReplayPlayer.js`
