# Market Requirements Document

- project: TAK-FLOW
- artifact: market_requirements_doc
- version: v2
- owner: Tao Conrad
- last_updated: 2026-07-03
- status: reviewed
- reviewed_by: Tao Conrad
- reviewed_on: 2026-03-13
- note: v2 (2026-07-03) restates every requirement against the enlarged verified surface — each Evidence Basis is now a claim ID plus a runnable command, not a "file exists" pointer
## Objective

Define the defense-adjacent problem TAK-FLOW is solving today and bound the claims to what the repository can currently support.

## Problem Statement

Operators in dense, degraded, multi-domain theaters need interfaces that surface uncertainty, provenance, and swarm-state changes without collapsing into map clutter. TAK-FLOW addresses that need as a simulation-first C2 visualization prototype, not as a fielded command system.

## Intended Users

- operators evaluating high-density track cognition workflows
- instructors running degraded-environment training drills (EW discipline, ghost discrimination)
- design engineers exploring trust-first C2 interfaces
- autonomy researchers studying swarm-state visualization and provenance signaling
- portfolio reviewers assessing high-assurance interaction design in defense-adjacent systems

## Required Outcomes

| Requirement ID | Requirement | Priority | Evidence Basis (claim → runnable) |
| --- | --- | --- | --- |
| MRD-001 | The system must visualize large mixed track populations without collapsing runtime responsiveness. | High | C-001/C-016 → `npm run smoke` (`tests/entity_identity.spec.js` mesh routing over 1,500+ tracks); bundle held under budget by C-017 → `npm run check:bundle-budget` |
| MRD-002 | The system must encode uncertainty, provenance, and confidence directly in the operator interface. | High | C-004 (designation guardrails), C-012 (EMCON decay + culling → `npm run test:ew`), C-013/C-021 (ghost zero-trust + RF families), C-015 (palette token sync) |
| MRD-003 | The system must support replayable audit context for key advisory and designation actions. | High | C-003 (round-trip → TP-007), C-024/C-025 (deterministic viewport + panel restoration), C-027 (canonical mission replay, `?demo=1`) |
| MRD-004 | The system must keep the map visually subordinate to decision support and recommendation workflows. | High | AUDIT.md P4 closeout (transport bar off-map, F5); C-026 overlay default-OFF with SIM labeling |
| MRD-005 | The project must provide executable verification for build, integrity, unit, and browser lanes. | High | C-007/C-008 → `npm run ci:verify` (22 browser tests + unit + budget); remote Actions enforcement on `augustave/TAK-FLOW` |
| MRD-006 | The project must provide browser-level scenario automation for operator workflows and scenario behavior. | High | C-018 (scenario controls → TP-009), C-020 (executable CONOPS mission), C-023 (training presets) |
| MRD-007 | Instructor tooling must compose drills (scenario + EW lay-down + decoy family) in one action. | Medium | C-023 → `tests/scenario_presets.spec.js` |
| MRD-008 | External claims must be traceable, and simulation stubs must be labeled honestly. | High | validated_claims_sheet_v1 (C-001…C-028); stub labeling in architecture spec v2; C-009 (deployment readiness) explicitly Rejected |

## Current Fit Assessment

- verified fit: theater-level C2 visualization, provenance-aware interaction design, deterministic replay/audit architecture, executable mission CONOPS, instructor drill presets, full local + remote verification lanes
- strong signal: EMCON decay/culling, zero-trust ghost families with spoof windows, advisory gating with counterfactual macro, route-memory overlay — each with its own browser assertion
- gap: AlphaEarth worker feed dormant (accessor mismatch — ICD constraint note); terrain-cost steering unverified until repaired
- gap: report-only figures (10k ghost burst, advisory latency) lack in-repo harnesses (C-013/C-014 limitations)
- gap: shader-side confidence colors and overlay ramps are code constants, not governed tokens

## Acceptance Criteria

- the repo is clearly framed as a simulation/C2 prototype, not an operational battle-management product
- every requirement row cites at least one claim ID whose evidence pointer is runnable from a fresh clone
- missing runtime or CI proof is stated explicitly rather than implied away

## Evidence Links

- `docs/defense-readiness/validated_claims_sheet_v1.md`
- `docs/defense-readiness/mission_conops_v1.md`
- `docs/defense-readiness/interface_control_doc_v1.md`
- `docs/defense-readiness/test_plan_v1.md`
- `package.json`
- `AUDIT.md`
