# Capture Strategy Deck

- project: TAK-FLOW
- artifact: capture_strategy_deck_v1
- version: v1
- owner: Tao Conrad
- last_updated: 2026-07-03
- status: draft
- rule: no slide-level statement without a claims-sheet row — every bullet below carries its claim ID (`validated_claims_sheet_v1.md`)

## Slide 1 — What TAK-FLOW Is

- A theater-level C2 **visualization and training prototype** for degraded, uncertainty-dominated environments (C-001).
- 1,500+ multi-domain tracks at interactive rates in a static browser client (C-001, C-016, C-017).
- Every capability on the following slides is backed by an executable test lane (`npm run ci:verify`: 22 browser tests, unit lane, bundle budget — C-007, C-008).

## Slide 2 — The Problem

- Dense theaters bury operators in tracks whose trustworthiness varies wildly; EW degradation makes position data probabilistic; decoys weaponize operator attention.
- Interfaces that treat every track as equally real produce designation errors and audit gaps.

## Slide 3 — Zero-Trust Track Handling (live demo beat 1)

- EMCON alpha-decay with automatic lost-track culling — tracks in jamming decay visibly and drop from scope (C-012, `npm run test:ew`).
- SIGINT ghost tracks are structurally barred from strike designation — `INSUFFICIENT TRACK PROVENANCE` (C-013).
- Ghost RF **profile families** with timed spoof windows emulate distinct emitter behaviors; the sub-0.5 confidence ceiling is a worker invariant, not a configuration (C-021, C-022).

## Slide 4 — Decision Support Under Fracture (live demo beat 2)

- Rule-based advisory gate surfaces swarm-fracture risk and supersedes generic guidance (C-014 functional path; heuristic — see Slide 8).
- One-click wide-area 3DGS counterfactual recon macro from the advisory card (C-020 step 7).
- Route-memory heat overlay: the hostile swarm's stigmergy grid rendered as intelligence — validated corridors in cyan, SAM denial in red-orange, labeled `(SIM)` (C-026).

## Slide 5 — Audit-Grade Replay (live demo beat 3)

- Deterministic replay: scrubbed frames restore exact identities and confidences for every entity class; live simulation cannot contaminate a restored frame (C-024).
- Panel-state fidelity frame-by-frame: Track Log selection, kinematics, advisory lifecycle, accumulated ops-log deltas (C-025).
- Lossless legacy import (`tak-flow.replay.v1`, `tak-h.replay.v1` → v2 normalization) (C-016, C-003).

## Slide 6 — Training & Instructor Story

- One-action training presets compose scenario + EW lay-down + decoy family: `EW-DEGRADED-LITTORAL`, `GHOST-DISCRIMINATION-DRILL`, `SWARM-FRACTURE-WATCH` (C-023).
- The preset id rides in every replay snapshot for after-action review (C-023).
- The canonical mission is an executable CONOPS: nine beats, browser-automated end-to-end (C-020, `docs/defense-readiness/mission_conops_v1.md`).

## Slide 7 — The Demo Script

Run live at a deployment (verified reachable — C-028) or boot the shipped artifact with `?demo=1` (C-027):

1. Open `?demo=1` — the GHOST-DISCRIMINATION drill replay loads into the transport (C-027).
2. Scrub to `MISSION_START`; step through the ghost designation refusal (C-013).
3. Jump the EW squall — watch EMCON ghosting and track culling (C-012, C-024).
4. Show the advisory onset and the 3DGS macro execution (C-020, C-025).
5. Finish on the designation + undo cycle and the export metadata (C-004, C-003).
6. Live variant: arm `GHOST-DISCRIMINATION-DRILL` from the instructor panel and run the same beats against the live sim (C-023), toggling `ROUTE MEMORY (SIM)` (C-026).

## Slide 8 — What This Is Not

- **C-009 — Rejected**: "TAK-FLOW is an operational command-and-control system suitable for defense fielding." *The repo supports prototype/simulation claims, not deployment claims.* Quoted verbatim from the claims sheet; it stays Rejected.
- The "V-JEPA" advisory gate is a **rule-based heuristic threshold** on live swarm order parameters — no learned model, no video embedding (architecture spec stub labeling).
- "AlphaEarth" terrain data is a **synthetic stub** (procedural random tensor); the worker-side terrain feed is currently dormant (ICD constraint note).
- The 10,000-ghost burst and 32.4 ms latency figures are **report-only** — no in-repo harness reproduces them yet (C-013/C-014 limitations).
- No integration with real sensors, radios, or TAK servers (mission CONOPS operational limits).

## Slide 9 — Audience Fit

- Defense-adjacent design/prototyping teams needing a working reference for uncertainty-first C2 interaction.
- Training-tools teams: instructor presets + deterministic after-action replay are the working skeleton of a drill product (C-023, C-025, C-027).
- Portfolio/technical reviewers: the claims sheet (C-001…C-028) maps every statement to a runnable lane — diligence is `npm run ci:verify` plus reading `validated_claims_sheet_v1.md`.

## Evidence Links

- `docs/defense-readiness/validated_claims_sheet_v1.md`
- `docs/defense-readiness/mission_conops_v1.md`
- `docs/defense-readiness/market_requirements_doc.md`
- `README.md` (Verified Claims section)
