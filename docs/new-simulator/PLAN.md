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
