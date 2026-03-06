from pathlib import Path

base = Path("/Users/taoconrad/Dev/GitHub 4/TAK-H/autonomous-aerospace-collective")
base.mkdir(parents=True, exist_ok=True)

swarm_md = """---
swarm_name: autonomous-aerospace-collective
type: swarm
version: "1.0.0"
owner: swarm-lead
status: active
domain_tags: [autonomy, aerospace, defense, avionics, mission-systems, reliability, business-development]
risk_level: critical
operating_environment: "High-Assurance / Export-Controlled"
topology: hierarchical
mission: "Design, build, validate, and deploy intelligent autonomous aircraft at scale."
skills:
  - defense-market-vanguard
  - mission-systems-architect
  - avionics-foundry-engineering
  - system-assurance-core
---

# autonomous-aerospace-collective (SWARM)

## Intent
A four-cell swarm that converts **regional defense needs** into a **physics-compliant aircraft architecture**, executes
**HV/LV electronics + PCB + integration**, and closes the loop through **test, lab, and failure analysis**—then packages
the outcome into a **capture-ready story** for the market.

## Global Invariants
- **Export & Compliance:** Strict adherence to export controls (EAR/ITAR where applicable) + anti-corruption constraints (FCPA).
- **MOSA Discipline:** Interfaces are modular, documented, and versioned (MOSA-first).
- **Physics Reality:** Architecture must be flight-testable within SWaP-C budgets; Flight Sciences veto is binding.
- **Traceability:** Every external claim (range/loiter/reliability) must trace to test evidence or validated analysis.
- **No “Random Glitch” Closure:** Failures require a physical/mechanistic root cause or they remain open.

## Artifact Bus (Shared Contract)
These are the only objects allowed to move between cells.

### Vanguard → Architect
- `market_requirements_doc` (markdown)
- `mission_conops_v1` (markdown)
- `constraints_export_control_v1` (markdown)

### Architect → Foundry & Assurance
- `architecture_spec_v1` (json/pdf)
- `power_budget_v1` (json)
- `rf_link_budget_v1` (json/pdf)
- `interface_control_doc_v1` (ICD, pdf)

### Foundry → Assurance
- `pcb_fabrication_pack_v1` (zip: gerbers, BOM, pick/place, drawings)
- `bringup_firmware_v1` (repo/ref)
- `prototype_build_record_v1` (markdown: serials, revisions, lot trace)

### Assurance → Architect & Foundry
- `test_validation_report_v1` (pdf)
- `bug_report_v1` (markdown + logs)
- `root_cause_analysis_v1` (pdf)

### Everyone → Vanguard
- `validated_claims_sheet_v1` (csv/markdown: every claim → evidence pointer)
- `capture_strategy_deck` (pptx)

## Canonical Run
1. Vanguard identifies “Long-Range Desert Surveillance” (Saudi/UAE context).
2. Architect converts CONOPS into budgets (power/link/thermal/weight) and ICDs.
3. Foundry designs HV battery + cooling + avionics PCBs and brings up firmware.
4. Assurance tests at elevated temps, finds failure mode, produces RCA.
5. Foundry corrects parts/layout; Architect updates budgets; Assurance re-tests.
6. Vanguard packages validated claims into the capture deck.

## Minimal Metrics
- Reliability: defect escape rate, HALT pass rate, repeat-failure rate
- Speed: architecture→prototype lead time, debug cycle time
- Traceability: % of external claims backed by evidence pointers
- Capture: pipeline conversion rate, proposal win rate (where applicable)
"""

vanguard = """---
name: defense-market-vanguard
type: skill
version: "1.0.0"
owner: business-development
risk_level: medium
intent: >
  Orchestrates go-to-market strategies for autonomous defense systems in the
  Middle East (Saudi/UAE focus). Translates geopolitical needs into product
  requirements that engineering can implement and validate.
inputs:
  - name: regional_intelligence
    type: text
    description: "Procurement cycles, MoD priorities, primes, offsets."
  - name: customer_signals
    type: text
    description: "Operator pain, mission profile, terrain/climate constraints."
  - name: technical_capabilities
    type: json
    description: "Current specs (range, payload, links, thermal limits)."
outputs:
  - name: market_requirements_doc
    type: file/markdown
  - name: mission_conops_v1
    type: file/markdown
  - name: capture_strategy_deck
    type: file/pptx
dependencies:
  knowledge: [foreign_military_sales_fms, itar_compliance, regional_cultural_protocols, fcpa]
ports:
  provides: [market_gap_analysis_v1]
  consumes: [test_validation_report_v1, validated_claims_sheet_v1]
---

# Operating Protocol
## Invariants
- Compliance: export controls + FCPA; no “workarounds”.
- Cultural Fluency: localized language + business etiquette for MENA.
- Evidence: claims must be backed by validated telemetry/tests (no speculative marketing).

## Execution Steps
1. Intel synthesis: stakeholder map + procurement path.
2. Gap analysis: need vs current aircraft capability.
3. CONOPS draft: mission narrative engineering can simulate.
4. Capture packaging: claims sheet + deck.
"""

architect = """---
name: mission-systems-architect
type: skill
version: "2.0.0"
owner: flight-sciences
risk_level: critical
intent: >
  Defines the aircraft’s integrated architecture: aerodynamics, comms, compute,
  sensors, and power. Balances SWaP-C and converts mission needs into a testable,
  buildable system design.
inputs:
  - name: market_requirements_doc
    type: file/markdown
  - name: mission_conops_v1
    type: file/markdown
  - name: constraints_export_control_v1
    type: file/markdown
outputs:
  - name: architecture_spec_v1
    type: file/json
    success_criteria: "Subsystem requirements & interfaces are buildable and testable."
  - name: power_budget_v1
    type: file/json
    success_criteria: "Fits mission profile with thermal margins."
  - name: rf_link_budget_v1
    type: file/pdf
    success_criteria: "BLOS/LOS link meets availability requirement."
  - name: interface_control_doc_v1
    type: file/pdf
    success_criteria: "MOSA-aligned interfaces with versioned contracts."
dependencies:
  knowledge: [mosa_standards, mil_hdbk_516c_airworthiness, link_budget_calculators, do_178c, do_254]
ports:
  provides: [architecture_spec_v1, power_budget_v1, rf_link_budget_v1]
  consumes: [market_gap_analysis_v1, test_validation_report_v1, bug_report_v1]
---

# Operating Protocol
## Invariants
- MOSA Compliance: interfaces are standard, documented, versioned (ICDs).
- Physics Reality: Flight Sciences veto on airworthiness/stability compromises.
- Security: comm links satisfy encryption requirements for BLOS contexts.

## Execution Steps (Orient → Design → Validate)
1. Decompose mission → subsystem requirements (power, comms, compute, sensors).
2. Trade study: make vs buy for critical subsystems.
3. Simulation: flight dynamics + thermal + link budget checks.
4. Architecture pack: spec + budgets + ICD issued as versioned artifacts.
5. Feedback: consume Assurance reports; revise vNext with deltas.
"""

foundry = """---
name: avionics-foundry-engineering
type: skill
version: "3.1.0"
owner: hardware-engineering
risk_level: high
intent: >
  Executes HV/LV electronics, PCB layout, harnessing, and firmware bring-up.
  Converts architecture specs into manufacturable, testable hardware.
inputs:
  - name: architecture_spec_v1
    type: file/json
    description: "Subsystem requirements + interfaces."
  - name: power_budget_v1
    type: file/json
    description: "Power envelopes and margins."
  - name: interface_control_doc_v1
    type: file/pdf
    description: "MOSA interface contracts."
  - name: complexity_tier
    type: string
    description: "intern | eng1 | eng2 | staff | senior"
outputs:
  - name: pcb_fabrication_pack_v1
    type: file/zip
    success_criteria: "Gerbers, BOM, drawings ready for fab."
  - name: bringup_firmware_v1
    type: repo/ref
    success_criteria: "Firmware + config to validate interfaces and IO."
  - name: prototype_build_record_v1
    type: file/markdown
    success_criteria: "Serials, revisions, lot trace, known issues logged."
dependencies:
  tools: [altium_designer, spice_simulator, thermal_analyzer]
  knowledge: [high_voltage_safety_270v, ipc_layout_standards, emi_emc_mitigation, dfm, supply_chain_risk]
ports:
  provides: [pcb_fabrication_pack_v1, bringup_firmware_v1]
  consumes: [architecture_spec_v1, power_budget_v1, bug_report_v1]
---

# Operating Protocol
## Invariants
- High Voltage Safety: creepage/clearance/isolation enforced for >270V designs.
- DFM: panelization, fiducials, testpoints, assembly constraints mandatory.
- Supply Chain: avoid EOL < 5 years unless explicitly waived.

## Execution Steps
1. Schematic capture: circuits from architecture constraints.
2. Layout: controlled impedance + SI/PI + EMI/thermal considered.
3. Power analysis: simulate efficiency/thermal dissipation where applicable.
4. Bring-up: bench validation + firmware interface checks.
5. Build record: revision/serial/lot trace + known issues.
"""

assurance = """---
name: system-assurance-core
type: skill
version: "1.0.0"
owner: reliability-ops
risk_level: medium
intent: >
  Validates reality against theory. Builds HIL rigs, runs qualification,
  performs failure analysis, and enforces lab discipline. Produces sign-off
  or blocks release with mechanistic root-cause requirements.
inputs:
  - name: prototype_hardware
    type: physical_ref
  - name: pcb_fabrication_pack_v1
    type: file/zip
  - name: bringup_firmware_v1
    type: repo/ref
  - name: failure_symptom
    type: text
outputs:
  - name: test_validation_report_v1
    type: file/pdf
  - name: root_cause_analysis_v1
    type: file/pdf
  - name: bug_report_v1
    type: file/markdown
  - name: validation_signoff
    type: boolean
dependencies:
  tools: [xray_imaging, logic_analyzer, python_automation_scripts]
  knowledge: [failure_mode_effects_analysis_fmea, halt_hass_testing, lab_safety_protocols, esd_control]
ports:
  provides: [test_validation_report_v1, bug_report_v1]
  consumes: [pcb_fabrication_pack_v1, bringup_firmware_v1]
---

# Operating Protocol
## Invariants
- Root Cause Obligation: no closure without mechanism (thermal runaway, whiskers, marginal SI, etc.).
- Lab Hygiene: ESD enforcement + calibration discipline.
- Automation: if a test runs more than twice, it becomes scripted and logged.

## Execution Steps
1. Triage: design flaw vs manufacturing defect vs ops misuse.
2. Analysis: X-ray/cross-section/log review; isolate the mechanism.
3. Stress: HALT/HASS/thermal cycles per risk profile.
4. Feedback loop: push `bug_report_v1` + RCA to Architect/Foundry.
5. Sign-off gating: only after pass criteria met.
"""

readme = """# autonomous-aerospace-collective (file pack)

## Files
- `SWARM.md` — root swarm config + artifact bus + invariants
- `defense-market-vanguard.skill.md`
- `mission-systems-architect.skill.md`
- `avionics-foundry-engineering.skill.md`
- `system-assurance-core.skill.md`

## Usage
- Treat `SWARM.md` as the orchestration contract.
- Each `*.skill.md` is a module with ports (provides/consumes).
- Artifacts named `*_v1` are versioned and should be treated as immutable once issued.
"""

(base / "SWARM.md").write_text(swarm_md, encoding="utf-8")
(base / "defense-market-vanguard.skill.md").write_text(vanguard, encoding="utf-8")
(base / "mission-systems-architect.skill.md").write_text(architect, encoding="utf-8")
(base / "avionics-foundry-engineering.skill.md").write_text(foundry, encoding="utf-8")
(base / "system-assurance-core.skill.md").write_text(assurance, encoding="utf-8")
(base / "README.md").write_text(readme, encoding="utf-8")
