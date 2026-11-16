> Historical checkpoints, archived 2026-11-16. Read [PLAN.md](PLAN.md) for current status and direction. Older next-task and verification restrictions below applied to their original batches.

# New circuit simulator: project plan

Status: editor-free/worker proofs, stable-ID document boundary, continuous RC run
and first editor prototype verified, 2026-11-13. See [PHASE-0.md](PHASE-0.md) for
results and remaining feasibility work. Frontend/platform choices remain open.

The document/adapter contract is described in [EDITOR-DESIGN.md](EDITOR-DESIGN.md) and
[WORKER-PROTOCOL.md](WORKER-PROTOCOL.md), with concrete JSON examples. These are
partly implemented contracts with broader proposed scope. Document loading and stable-ID results are
implemented separately from the Phase 0 API; see [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md).
Revision gating and candidate-worker replacement/reset now run on that boundary;
see [COORDINATOR.md](COORDINATOR.md). Continuous scheduling and RC live edits are
also implemented: [RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md). Editor interaction
prototype is now implemented in [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md).
The latest pass adds separate Move/Drag commands with atomic undo, a searchable
component chooser and KiCad-style A/R/M/G/W/E/P shortcuts, building on the
grid-aligned contacts and local wire cleanup. Inline two-pin insertion now removes
the bypass span atomically, including spans split by two-way junctions. Next:
wire-end reconnection and cleanup of rejoined loose wires. The catalog now includes
three-pin op-amps; X/Y flips, non-loading voltage markers and E/double-click modal
properties are implemented. Switch bodies single-click to toggle. Sine sources
with amplitude/frequency/DC offset, selected property values and explicit loose
wire endings are also implemented. AC/DC sources now have one- and two-terminal
presets and a waveform selector (including duty for square/pulse). A docked
oscilloscope now captures per-step worker samples and plots multiple named voltage
probes together with shared scales, cursor readings and bounded history. Frontend/platform choice
remains open.

## Purpose and agreed direction

Build a modern circuit editor with excellent component placement, wiring,
selection, navigation, and signal inspection. The main motivation is interaction
quality; simulation speed on complex circuits is secondary. The user's chosen
interaction reference is KiCad: quiet pin joins, precise grid contacts and dragging
that stretches connected wires. This preference does not select the UI toolkit.

Preserve CircuitJS's existing electrical algorithms and models where practical.
Do not make a simulation rewrite a prerequisite for the new interface. The user
is willing to undertake a substantial project and is interested in Rust and WASM,
inspired by https://github.com/tangency-labs/solidcraft.

Rust, browser-first delivery, the UI toolkit, and repository layout are proposals,
not final decisions. A separate application and an extracted engine are the
working architectural direction, subject to a feasibility investigation.

## Architecture to investigate

- Circuit document: stable component/pin IDs, explicit connectivity, parameters,
  and visual layout. Simulation results are separate from the saved document.
- Editor: selection, placement, wire editing, snapping, navigation, and reversible
  commands for undo/redo.
- Renderer: symbols, labels, interaction previews, probes, and waveforms.
- Engine adapter: translates the document into simulator inputs and maps results
  back to stable IDs. Numerical node indices must not become document identities.
- Existing CircuitJS engine: retain the Java-to-JavaScript implementation first;
  investigate background worker execution after identifying browser dependencies.

The existing engine derives connections partly from geometry. Explicit new-editor
connectivity therefore needs a tested translation; it is not an existing engine API.
Define parameter changes, switch events, topology changes, reset behaviour, and
stale-result handling explicitly. Transport results in batches rather than issuing
one cross-language call per component per simulation step.

## Phase 0: feasibility and decisions

1. Reproduce the current build and run representative circuits. Record toolchain
   versions and actual commands. README currently specifies Java 8 and Gradle 8.7.
2. Map the dependencies between SimulationManager, CircuitElm/component models,
   UIManager, loading, scopes, timing, and browser APIs. Identify global/static state.
3. Build the smallest proof that an external caller can load and advance a circuit
   and read results using the existing maths. A temporarily UI-hosted bridge is
   acceptable for discovery, but does not prove worker or headless operation.
4. Investigate deterministic stepping and capture baseline outputs from the
   unchanged simulator. Fix timestep, initial conditions, parameters, and sample
   times; choose justified tolerances for comparisons.
5. Compare frontend options with a small interaction prototype, including a Rust
   candidate. Check browser text/input, high-DPI rendering, trackpad interaction,
   accessibility, packaging, and compatibility with the engine bridge.
6. Record a decision covering target platforms, UI stack, bridge/extraction scope,
   licensing obligations for reused code, repository layout, and first component set.

Exit: a runnable engine bridge, a documented dependency map and limitations,
repeatable baseline capture, and an architecture decision supported by the spike.
Avoid broad refactoring before these questions are answered.

## Phase 1: engine boundary and verification

Extract only what the first working circuits require. Keep numerical changes
separate from structural changes. Expose load/reset, bounded stepping, parameter
updates, running state, result batches, and structured diagnostics.

Start reference coverage with a voltage divider, RC transient, RLC transient,
diode rectifier, and switch event. Add analytic checks where available, alongside
comparisons with the existing implementation. Existing behaviour is the
compatibility reference, not proof of physical accuracy for every circuit.

Exit: agreed sample circuits reproduce baseline results within documented
tolerances and the boundary can be driven independently of the old editor.

## Phase 2: first complete editing experience

Support sources, ground, resistors, capacitors, and wires. A user can build a
voltage divider and RC circuit, edit values, select and move groups, undo/redo,
save/reopen, run/pause/reset, and inspect voltage and a waveform.

Specify interaction rules before expanding features: click/Shift-click/marquee,
hit targets, zoom anchor, snapping, junctions versus crossings, connected movement,
wire bend editing, Escape, and cancellation. Keep input responsive during simulation.

Exit: those two circuits are pleasant to build and edit end to end, with verified
simulation results. Assess actual interaction quality, not just screenshots.

## Phase 3: broaden and harden

Expand models and CircuitJS import compatibility incrementally. Report unsupported
elements explicitly. Add larger-circuit measurement, error recovery, probes,
waveform tools, and desktop packaging if selected. Consider Rust engine ports only
when a demonstrated requirement justifies their validation cost.

## Deferred scope layout request — 2026-11-13

The user wants the future option of multiple independent scope panes arranged
stacked vertically or side by side. The current single dock already overlays
multiple voltage probes; separate panes are not implemented. The user explicitly
deferred this work while ending the session. Probe grouping, linked/independent
scales and cursors, resizing and layout persistence remain design decisions.
See the end-of-day section of HANDOFF.md before continuing.

## Working practices

- Keep the deployed fork usable while exploring the new application.
- Use focused branches and reviewable milestones; no deployment is implied.
- Update HANDOFF.md at session boundaries with changes, checks, blockers, and the
  next concrete task. Add dated decisions here or in a linked decision document.
- Share source, plans, fixtures, and setup instructions through Git. Keep generated
  output and machine-specific paths out of shared instructions.
- At machine changes, commit and push intended work, then fetch/pull on the other
  machine. Uncommitted local files do not transfer through Git.

## Authorized continuation — 2026-11-14

Endpoint reconnection, background grid modes and multiple scope panes are now
implemented (superseding their previous deferred status). Scope views share time,
cursor and acquisition, with independent channel visibility and voltage scales;
settings remain session-only. See HANDOFF.md for exact limits and verification.
Next checkpoint: run the new browser cases and visually review the interaction and
multi-pane layout; sandbox restrictions prevented those checks in this session.

## Full library priority — 2026-11-14

The user considers the editor usable and now prioritizes the full Falstad component
set and all example circuits. Copy/paste/duplicate and directional box selection
are implemented as the immediate editing milestone. Further cosmetic/editor
polish is secondary to library compatibility.

The initial parity baseline is the source bundled in this fork, not a claim about
the latest upstream release. [LEGACY-CATALOG.md](LEGACY-CATALOG.md) and the generated
JSON inventory enumerate 140 menu-referenced element classes, 125 statically
resolved record types, 374 circuit files and 368 menu entries. None of the legacy
examples is claimed importable yet. Regenerate using
`python3 tools/inventory_legacy_catalog.py` when the bundled catalog changes.

Next implementation: legacy text importer for existing models with explicit
connectivity and unsupported-record diagnostics; then inductors, diodes, current
sources and potentiometers, followed by remaining analog, digital and specialized
families. Preserve original model equations. Add the categorized example chooser
alongside import coverage; do not silently omit unsupported records or present
partial circuits as working originals.

For this batch the user requests build-error checks only: do not run functional
suites, browser verification, screenshots, visual checks or browser automation.

## Components before import — 2026-11-14 (latest)

User explicitly deferred legacy import and prioritized component coverage/checks.
The first expansion adds 16 models (23 total), including basic inductive/diode/current/
potentiometer models, both bipolar polarities, N/P MOS/JFETs and basic logic gates.
They build and pass non-browser regression/numerical/Node-worker checks. This is
partial library coverage, not completion. Next: transformers, switches, LEDs/Zeners,
then sequential logic/chips and specialized families. Import/example browsing follows
component support. See the latest HANDOFF section for checks and precise limitations.

## 28-model milestone — 2026-11-14

Transformer, center-off SPDT, DPDT, LED and Zener support now joins the earlier
23-model catalog. Builds and all nine non-browser Node suites pass, including
analytic winding responses, switch positions, semiconductor behavior and actual
Node worker/direct agreement. Full component parity is still in progress; next
are polarized capacitors, additional passive/switch variants and sequential logic.
Import/examples remain deferred. HANDOFF.md records supported parameters and limits.


## 31-model milestone — 2026-11-16 (historical)

Polarized capacitors and voltage-controlled SPST/SPDT switches are implemented,
including editable parameters, symbols, stable result mapping and worker capability
advertisement. Fresh Java/GWT builds and all ten non-browser Node suites pass.
Numerical checks also required private grid initialization, conservative controlled
SPDT matrix connectivity and an early return after model-triggered stops. Component
stamping/equations remain unchanged. See the latest HANDOFF section for exact
parameters, legacy timing behavior, check commands and remaining limits.

Next batch: tapped transformers and remaining mechanical switches (starting with
crossover), then sequential logic/chips. Full component parity is still incomplete.
Legacy import and example browsing remain deferred; browser/visual verification
remains excluded under the recorded user preference.

## 34-model milestone — 2026-11-16 (historical)

Output markers, logic outputs and ground-referenced logic inputs now join the
catalog, ahead of the previously recorded tapped-transformer/mechanical-switch
batch, because `O`/`M`/`L` are used by 108/66/67 bundled examples and are the
largest near-term legacy-import blockers. They include editable parameters, symbols,
live level/voltage labels, stable result mapping, ideal-source preflight and worker
capability advertisement. The guarded loader validates O/M/L field counts, flags,
scale and state rules. Fresh Java/GWT builds and all eleven non-browser Node suites
pass. Component stamping/equations remain unchanged; intentional limits are the
OutputElm scale/fixed-precision options and LogicInputElm momentary button.

Next batch: sequential logic/chips, then remaining analog/specialized families.
Full component parity and legacy import remain deferred, with browser/visual
verification still excluded under the recorded user preference.

## 37-model milestone — 2026-11-16 (latest)

Base D, JK and T flip-flops now join the catalog, covering the legacy 155/156/193
chip records used by bundled sequential examples. They include editable logic
voltage/initial state (and JK clock edge), chip symbols, live Q labels, stable
pin/result mapping, complementary ideal-output preflight and worker capability
advertisement. The guarded loader validates chip field counts, flags, geometry
and stored Q/Q̄ state. Fresh Java/GWT builds and all twelve non-browser Node
suites pass. Component stamping/equations remain unchanged; intentional limits
are base variants only (no D set/reset pins or small-chip flag) and no aggregate
chip current.

Next batch: counters, latches and combinational chips, then tapped transformers
and remaining mechanical switches. Full component parity and legacy import remain
deferred; browser/visual verification remains excluded under the recorded user
preference.

## Falstad Add popup and 41-model milestone — 2026-11-16 (latest)

A/Add now mirrors the bundled original simulator's menu labels, hierarchy and order,
including entries for pending models (visible, disabled with a reason). The menu
is generated from Menus.java; full menu visibility does not imply model parity.
Four-bit counter/latch/register and half/four-bit full adders join the catalog.
Original chip equations and previous-step input timing are retained. See HANDOFF
for verification and DOCUMENT-ADAPTER for fixed-width variants and startup limits.

Next: multiplexer/demultiplexer and remaining digital chip families, followed by
tapped transformers/mechanical switches and other pending analog/specialized types.
Legacy import/example browsing remain deferred. No browser/visual checks under the
recorded user preference; no deployment.

## Context-menu order priority — 2026-11-16 (latest)

User now prioritizes completing the three menu groups in this order: Passive
Components, Inputs and Sources, Outputs and Labels. This supersedes the next-digital-
chip recommendation above. Continue reusing legacy electrical models and validating
the document/worker connection rather than rewriting their equations.

The first five missing passive entries are implemented: push/MBB switches, tapped
and fixed-three-winding custom transformers, and transmission line. Catalog: 46
models. Passive-menu availability is 13/24 entries; sources 8/17 and outputs/labels
2/20 (aliases/presets mean menu counts are not model counts). Next missing entries
are Relay, Relay Coil and Relay Contact. Continue the rest of passives before moving
to sources, then outputs/labels. Legacy import and example browsing remain deferred.

## Variable Voltage and Outputs/Labels — 2026-11-16 (latest)

Remaining passives are deferred per latest user direction. Variable Voltage and
all 20 Outputs and Labels menu entries are now integrated: 65 editor/document models
including three inert annotations. Sources are 9/17 entries; passives remain 13/24.
The variable source Inspector slider uses state-preserving worker updates; annotation
edits preserve electrical identity. New meters, displays, LED array, recorders,
trigger and motors reuse original Java models. Optional AC phase permits balanced
three-phase excitation. Inspector includes measurements, probe plotting, CSV and
audio playback/WAV; stop triggers pause continuous runs. Display widths and array
size are fixed in this slice; broader variants and legacy import remain deferred.
See the latest HANDOFF section for parameter/measurement/capture limits and checks.
No browser or visual verification under the recorded user preference.

## Continuous editing and default Run — 2026-11-16 (latest)

Simulation now runs by default (`autoRun: false` is available for manual stepping).
Run/Pause survives layout/electrical edits and reset; Pause during installation wins.
Invalid intermediate documents retain the selected intent and resume when repaired.
Floating parts no longer block simulation: the original solver supplies its existing
100 MΩ reference stabilization. Open current sources use its high-resistance fallback.
Warnings replace the previous floating/return-path rejections. Ideal-loop validation
and genuine solver-fault stops remain. Topology changes rebuild/reset then resume;
pure layout changes and live variable-voltage/contact edits preserve solver state.
Live contacts cover SPST, push, SPDT, DPDT, MBB and logic-input state changes, with
FIFO revision/epoch guards. See latest HANDOFF for verification and remaining limits.

## Native in-place circuit edits — 2026-11-16 (latest)

Ordinary same-document electrical edits now update the existing worker and retained
legacy element instances through guarded `updateCircuit`, followed by original
Falstad reanalysis. Value edits, component additions/removals and named-net rewiring
retain simulation time and existing dynamic state. Timestep edits are also in place.
Editable configuration is copied explicitly; constructor defaults do not overwrite
live state. Run/Pause and FIFO revision/epoch gates remain. Explicit Reset, a different
document or actual fault recovery still creates a new session. Native buffer-changing
options may reset their own buffer as in the original; unrelated models are retained.
This supersedes earlier topology-edit reset limitations. See latest HANDOFF and
`tools/test_live_reanalysis.mjs` for contracts, checks and remaining validation limits.
