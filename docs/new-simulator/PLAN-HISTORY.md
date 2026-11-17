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


## Snapshot before maintenance cleanup — 2026-11-17

Historical snapshot; current instructions live in PLAN.md.

# New circuit simulator: current plan

Updated 2026-11-17. This is the current plan. [PLAN-HISTORY.md](PLAN-HISTORY.md)
preserves previous milestones and superseded next-task notes.
[HANDOFF.md](HANDOFF.md) contains the current implementation/build/test checkpoint.

## Editor cleanup — 2026-11-17

The intermediate JavaScript editor (`editor.js`, `editor.html`, `editor.css` and
`scope-view.js`) has been removed at the user's request. React in `wires/` is the
active new editor; its separate Vite `/editor.html` preview remains. This cutover
does not certify full Falstad compatibility or complete browser parity.

- `packages/circuit-runtime`: low-level, document and revision worker entry points;
  the React worker calls the core modules directly without prototype adapters.
- `wires/src/editor/menu`: generated Falstad menu hierarchy and availability map;
  `tools/generate_component_menu.py` writes here.
- `tools/engine-harness`: retained engine verification pages, traces, regression
  helpers and compatibility adapters for existing tests. No React dependencies.
- `makeEngineSite` and the cached fallback assemble runtime plus harness, clearing
  stale output. Vite packages runtime/core/compiled engine only.
- Prototype DOM-specific editor/drag/loose-end browser runners and the verifier's
  `--editor`/`--screenshot` modes are retired. Core/model/numerical tests remain.

The original Falstad Java/GWT interface remains available through `makeSite` as a
development reference and existing deployment. Earlier sections describing the
intermediate editor as a live reference are historical and superseded by this
cleanup. Recover its source from Git history if needed; do not restore it as a
runtime dependency. Existing React, symbol, core and Java work was preserved.

See [UPSTREAM-ARCHITECTURE.md](UPSTREAM-ARCHITECTURE.md) for the dated source audit,
repository options and proposed upstream update checks. A clean upstream checkout
plus a small patch layer remains a proposal; no repository/submodule conversion
was performed. Next establish the engine boundary and import/compatibility
fixtures while preserving the current app.

## Direction

Build a new editor while preserving CircuitJS's electrical models and simulation
algorithms. KiCad is the interaction reference. Stable document identities and
explicit connectivity must survive a change of frontend.

The agreed direction is a **complete migration of the original bundled Falstad functionality into the
React/TypeScript application in `wires/`, with shadcn/component libraries for the
shell and an SVG editor sheet**. Preserve the old app's features and interaction
details; the goal is the same editor in React, with its styling easier for the user
to control. This is not a request for a smaller prototype or a new interaction
design. Build menus, property dialogs, scope, simulation controls and the sheet
as React components. The React sheet uses the full workspace width. Double-click
a symbol or press E to open its properties. Readings and component actions live
in the dialog. The draggable Sliders panel opens when a variable voltage source
or potentiometer is placed. Its live controls share a reorderable list. Slider
labels are saved with the circuit, and the potentiometer wiper follows its
slider while the user drags it. Use shadcn Base Mira
components for visible controls and surfaces,
including buttons, menus, dialogs, cards, sliders and sheets where applicable.

The JavaScript shared core and existing CircuitJS simulator remain in place.
Keep direct JS/TS calls between the UI and editing core, with simulation in its
existing asynchronous worker. Minimizing runtime language/translation boundaries
is a priority. Rust/GPUI and a solver rewrite are not the current workstream.
Desktop packaging is desired later, but Tauri versus Electron and platform scope
remain undecided. SVG is the starting renderer; Canvas can be reconsidered if
representative measurements establish a need.

## Current checkpoint

| Area | Implemented | Still open |
| --- | --- | --- |
| Engine boundary | Editor-free Java/GWT engine, dedicated worker, bounded stepping and stable-ID results | Full legacy compatibility, larger-circuit performance and broader platform verification |
| Continuous editing | Default Run; guarded in-place value/topology/timestep updates retain existing model state and engine time | Unsupported configuration/model variants; exhaustive behavior across the entire legacy library |
| Document boundary | Schema v1, explicit graph, stable IDs, canonical electrical projection, save/open | Schema migration policy; further separation only when a concrete frontend requires it |
| Library | 84 document/editor models, including 3 graphics, with original model equations reused | Full component and variant coverage |
| Prototype interactions | Stateful connected dragging; section merge/tail cleanup; detached rotation/flip; wire-to-pin drops; loose-end routing; preserved wires on component deletion | Full native KiCad equivalence; reusable interaction modules are now extracted |
| Signal inspection | Per-step voltage/current samples, per-trace settings/axis selection, mixed dock splits, floating/sheet scopes, exact-time cursors, saved scope workspace, live meters and capture | Frequency/period measurements, triggering/FFT and requested interactive verification |
| Legacy import | Source inventory and coverage mapping | No general legacy text importer or bundled-example chooser |

Current menu availability includes 18/24 Passive Components, 14/17 Inputs and
Sources, 20/20 Outputs and Labels, 14/17 Active Components, 6/24 Active Building
Blocks, 9/10 Logic Gates, Input and Output, 7/21 Digital Chips, and 0/6 Analog
and Hybrid Chips. Menu counts include placement presets. See
[LEGACY-CATALOG.md](LEGACY-CATALOG.md) and [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md).

## Shared-core extraction — completed 2026-11-16

The reusable code now lives in [packages/circuit-core](../../packages/circuit-core/README.md):
shared catalog/pin/default metadata, geometry, document validation, history,
commands and drag graphs, compiler/session adapter, revision protocol, simulation
coordination and sampled-signal state. Native ESM and classic/Node entry points
share the same implementation. The reference UI uses compatibility adapters.

A standalone consumer imports only this package, edits a divider and drives the
real retained worker without the prototype renderer/inspector. The numerical,
worker and history/interaction tests remain the portability boundary. The subsequent discussion chose React/SVG as the next starting direction.
`wires/` now includes a separately mountable React editor and `/editor.html`
preview. `wires/src/App.tsx` mounts that React editor; preserve the user's existing
shell and styling changes while completing parity.

## React migration progress — 2026-11-16

The React app is active in `wires/src/App.tsx` and currently contains a broad but
incomplete port: common sheet gestures, menus, file actions, probes, properties,
simulation controls and a multi-pane scope. All 84 supported models use authored
React SVG views on the sheet and during placement. Preserve the shell and
styling work; the intermediate JavaScript reference editor is now retired.

A real behavior mismatch was found in scope playback: the old editor configures
`batchSteps: 10, intervalMs: 16`, while the React app inherited the core's default
of 128 steps per tick. This made simulated time move 12.8x faster at the same
time/div. React now matches the old cadence and acquires samples from `onFrame`.
The user reports that the pace is better. A strict sample-channel shape mismatch
that caused a blank React page was also fixed. These fixes improve the current
slice; neither establishes whole-app parity.

Continue by using the old application as a behavior specification. Maintain a
[parity inventory](REACT-PARITY.md), then migrate complete feature groups in coherent slices. A
bounded change is a delivery unit, not a reason to leave an entire old feature
behind. For each slice, compare the old source and the React implementation,
preserve the shared core/worker contracts, and record checked versus unchecked
behavior. Follow the current verification constraints in HANDOFF.md; do not claim
browser-level parity without browser verification.

## Milestone: migrate the working editor into React

Build on `wires/`; the intermediate JavaScript editor is retired. The React app must implement the old behavior in
React/SVG; do not embed the old application or copy its monolithic renderer and
event handler wholesale. Keep behavior and styling decoupled.

1. **Inventory parity.** Map each legacy UI feature and shortcut to its source in
   `editor.js`, `editor.html`, `editor.css`, `scope-view.js`, component menu and
   property dialog modules. Track implementation and verification separately.
2. **Complete shell commands.** Keep File/Edit/View/Add menus and wire each action
   to React-owned state/core commands. Preserve New/Open/Save, autosave, examples,
   undo/redo, clipboard, duplicate, transform, delete, view and grid behavior. Keep
   only Start/Stop/Reset always visible for simulation.
3. **Match the sheet.** Port camera, zoom/fit, directional selection, focus and
   keyboard semantics, placement previews, connected/detached movement, rotation,
   flips, switches, momentary controls, wire routing and segment edits, loose-end
   reconnection, probes, junctions and deletion/undo rules. Continue using the
   shared editing core for connectivity and transactions.
4. **Migrate the full component library and property dialogs.** Move each symbol into its
   authored TSX module with shared pin/default metadata. Port chooser groups,
   per-kind properties, validation, meters/outputs, variable controls and recorder
   or audio actions. Keep unsupported models and variants explicit until migrated.
5. **Match simulation and scopes.** Preserve worker lifecycle, cadence, sample
   channels, run/step/reset states, trace scaling, cursor readings, channel
   visibility, pane layout, clear, capture and audio behavior. Compare each against
   the legacy app, including time progression at equal settings.
6. **Finish persistence and cutover.** Preserve schema-v1 documents, IDs and
   connectivity through New/Open/Save/autosave/examples. Check representative
   circuits and end-to-end workflows. Make React the sole active frontend only
   after the old app's full feature set has a React counterpart and parity gaps are
   resolved; keep the old source/reference available until the user accepts it.

Intermediate acceptance checkpoints are useful for each group, but completing the
divider slice is not the migration's finish line. The final acceptance criterion
is the complete old editor feature set implemented in React, with behavior parity
and styling the user can customize. Do not call the migration complete based only
on builds, type checks or a rendered example.

## Scope checkpoint and next priority — 2026-11-17

The scope interface/persistence slice is implemented. Each probe starts in its own
scope; traces combine/separate, use independent vertical scales/positions, and share
pane time scale. Selected trace controls the coloured vertical axis. Saved mixed
horizontal/vertical dock splits coexist with movable floating panels and grid-snapped
sheet scopes that zoom with symbols. The dock caps at 50% of screen height.

Latest cursor contract: hover reads live samples at the pointer position;
click-and-hold tracks one fixed sample. Panes synchronize by exact sample time across
different time scales. Trace names/gears stack bottom-left; cursor value, time/div
and vertical units/div sit top-right. Detailed settings/measurements remain in
properties/context menus. Preserve the simplified UI; removed controls are not
missing parity work. See HANDOFF.md for source ownership and full current behavior.

Save/Open/autosave now include optional version-1 `layout.scopes`, including groups,
selected axes, time scales, dock split ratios/order, floating/sheet dimensions and
positions, reference zoom and panel open/height. Per-trace settings stay on probes.
Layout changes commit after gestures and support Undo. Older files retain defaults.

The user reported substantially improved navigation after camera/render isolation.
Build and TypeScript checks pass; broad browser verification remains pending and
must not run unless requested. Honour the user's low-credit preference: focused
source/build/type checks, no browser verification or unsolicited broad test runs.

## Priority correction — Falstad parity first

**Current priority: full functionality of the bundled original Falstad app before
new custom tools.** Parity with the JavaScript prototype alone is insufficient;
use the original Java/GWT menus, dialogs, element models, file formats and bundled
examples as the full specification. Keep the user's React styling and accepted
scope interactions; functional parity does not require restoring rejected UI.

1. **Legacy circuit compatibility and examples:** import/export native circuit
   text, including flags, models, connectivity and scope settings; expose bundled
   examples. Start with supported records and explicit unsupported diagnostics,
   never silently omit elements. Track loadability separately from type coverage.
2. **Complete models and variants:** use LEGACY-CATALOG.md/JSON to close the actual
   menu/example coverage gaps, prioritising commonly used missing models such as
   the 555 timer and relay, then remaining building blocks, chips and variants.
3. **Original scope/measurement functions:** finish trigger, frequency/period,
   spectrum/FFT, XY and other native measurements/plots, retaining the simplified
   React presentation and existing exact-time cursor/layout behavior.
4. **Remaining native workflows:** inventory and complete missing commands,
   component/model options, simulation controls, recording/audio and import/export
   actions against the original app, not just the prototype.
5. **Acceptance/cutover:** compare supported numerical behavior, saved examples and
   representative workflows; keep the reference until the user accepts parity.
   Continue the low-credit/no-browser-check constraint unless the user changes it.

The first concrete slice should be legacy text import for already-supported
components with clear unsupported-record reporting, followed by bundled-example
loading. This makes remaining coverage gaps visible using real Falstad circuits.
Do not claim all 374 bundled circuit files are loadable from the current 84-model
inventory. See LEGACY-CATALOG.md for the static inventory and its limitations.

Slider automation, looping modulation, parameter sweeps and Bode tools are deferred
until native Falstad functionality is complete or the user explicitly reprioritises.

## Deferred custom-tools roadmap

Do not start this roadmap before full native Falstad parity unless the user
changes priorities. Continue tracking native and React editor parity in the
[parity inventory](REACT-PARITY.md). The headless worker already
supports bounded stepping, live circuit updates and time-aligned probe samples.
Build on those capabilities for modulation, parameter tuning and frequency response.

1. **Automate sliders.** Add an **Automate** action to the Sliders card. Start with
   one potentiometer, a ramp with a configurable range and duration, and the
   existing scope. As a first end-to-end check, ramp the pot from 10% to 90% over
   two simulated seconds and watch the wiper and output trace. Apply parameter
   changes in the worker at solver step boundaries while retaining circuit state.
   Use simulation time so pause freezes the ramp and reset starts it over. Save
   the automation settings with the circuit and keep playback out of undo history.
   Extend the same controls to looping triangle modulation, variable voltage
   sources and other supported slider parameters.
2. **Sweep part values and plot measurements.** Let the user choose a parameter,
   a range and a measurement. Run the sweep in a separate worker using a snapshot
   of the circuit. Plot the measurement against the parameter value. For example,
   sweep a feedback resistor and plot gain against resistance. Let the user pick
   a result and apply its value to the circuit as one undoable edit.
3. **Run frequency sweeps and display Bode plots.** Choose an excitation source
   and input and output probes. Run stepped sine tones with the transient solver,
   allow the response to settle at each frequency, then measure output gain and
   phase relative to the input. Plot gain in dB and phase in degrees against log
   frequency. Validate with an RC low-pass, which should read about −3 dB and
   −45° at cutoff. SPICE-style small-signal AC analysis is a later solver milestone
   that requires linearizing the circuit around its DC operating point.

## Symbol authoring contract

**One authored file per symbol** is the user's chosen direction. A file such as
`resistor.tsx` should co-locate metadata and the React view, so changing the shape,
lead lengths, pin locations or defaults does not require hand-editing another
catalog elsewhere. Proposed location: a reusable `packages/circuit-symbols/src/`
package imported by `wires/`; this path and initial build tooling now exist. Keep ordinary UI components under `wires/src/components/` and sheet/layer code
under `wires/src/editor/`. The important decision is ownership, not filename case.

The UI imports the view and metadata. A build step emits the **data-only** portion
for `circuit-core` and workers. This generated artifact is not a second handwritten
source and adds no runtime Rust/JavaScript bridge. Generated catalog freshness and
pin/default equivalence need checks. Do not make the core or worker import TSX,
React, shadcn, a DOM renderer or an SVG component at runtime.

Keep stable component kinds/pin IDs, current metadata shape, schema-v1 files and
explicit connectivity. Native simulator post order/current conventions remain
explicit and distinct from SVG/display pin order. Electrical equations remain in
the retained simulator. For each migrated kind, switch ownership atomically so its
pin geometry/defaults are not maintained in both the authored file and catalog.

Source ownership:

- Historical SVG strings: retired `experiments/engine/editor.js` in Git history;
  current symbols are authored TSX in `packages/circuit-symbols/src`.
- React SVG and metadata: `packages/circuit-symbols/src/<kind>.tsx`; generated
  plain-data definitions in marked `packages/circuit-core/catalog.js` sections.
- Symbol registry and catalog order: `packages/circuit-symbols/index.ts`.
- World-coordinate pin transforms: `packages/circuit-core/geometry.js`, `pin()`.
- `wires/src/App.tsx`: user-owned shell/menu work.
- `wires/src/editor/`: mountable React editor and session hook; `/editor.html` is its separate preview.

A renderer-only edit may change the body, stroke, color and labels freely. Editing
pin positions in the authored definition must change both visible lead endpoints
and core hit/snapping/connection geometry together. Include a regression check for
that relationship rather than drawing a second, independently positioned pin.

## Library work after the boundary checkpoint

The target is full component coverage for the bundled Falstad fork. Audio and
data import and export workflows are deferred for redesign.

The current batch adds sweep, antenna, AM, FM, noise, XNOR, both Schmitt
triggers, spark gap, memristor, tunnel diode, fuse, photoresistor, thermistor,
SCR, DIAC, TRIAC, varactor and triode. All 19 ran and accepted a live circuit
update in the compiled worker. Browser interaction checks remain open.

The remaining menu entries include relays, crystal, cross switch, gyrator,
Darlington pairs, unijunction transistor, controlled sources, other active
building blocks, bus input and digital and hybrid chips. External JavaScript
voltage requires a decision about its input interface.

For each batch, extend metadata, compiler/worker capabilities, parameter validation
and numerical/worker fixtures before adding minimal exposure in the reference
harness. Preserve original equations. This work should benefit either frontend.

Legacy import follows sufficient model/variant support. Start with a measured
subset and explicit unsupported-record diagnostics; validate original flags,
parameters, connectivity and sample results. Do not silently drop records or claim
all 374 bundled files load because their record types appear in the catalog.

## Guardrails and decisions still needed

- Keep the deployed application usable; the prototype build remains opt-in.
- Separate solver changes from structural extraction and frontend work.
- Preserve explicit connectivity: render/load does not join crossings. Editor
  commands such as wire-to-pin drops create explicit contacts atomically.
- Rotation and X/Y flip are detached pick-up/put-down operations. M detaches;
  ordinary pointer/G dragging retains connections. See [DRAGGING.md](DRAGGING.md).
- Keep browser verification claims scoped to cases actually exercised. Older
  batch-specific requests to skip browser checks are historical; recent drag,
  orientation and wire-drop work was browser-tested. Broader catalog/UI behavior
  is not thereby certified.
- Record scope-layout persistence, desktop wrapper/platforms and migration policy
  when decided. React/SVG is the agreed starting direction. Multiple scope panes exist; their arrangement/settings are not a
  final persistent workspace design.
- Keep the React migration and retained worker changes together on `new-sim`.
  Check for local edits before updating the worktree.
