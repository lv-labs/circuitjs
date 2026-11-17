# New circuit simulator: current plan

Updated 2026-11-17. This is the current plan. [PLAN-HISTORY.md](PLAN-HISTORY.md)
preserves previous milestones and superseded next-task notes.
[HANDOFF.md](HANDOFF.md) contains the current implementation/build/test checkpoint.

## Direction

Build a new editor while preserving CircuitJS's electrical models and simulation
algorithms. KiCad is the interaction reference. Stable document identities and
explicit connectivity must survive a change of frontend.

The agreed direction is a **complete migration of the existing editor into the
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
| Signal inspection | Worker samples, voltage probes, multiple scope panes, output measurements/capture | Broader performance/platform coverage and final UX/layout decisions |
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
styling work and keep `experiments/engine/editor.html` as the behavior reference.

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

Build on `wires/` and keep `experiments/engine/editor.html` working as the complete
reference throughout migration. The React app must implement the old behavior in
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

## Simulation tools roadmap

The next new feature is potentiometer automation. Continue tracking React editor
parity in the [parity inventory](REACT-PARITY.md). The headless worker already
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

- SVG strings: `experiments/engine/editor.js`, `symbol()` (resistor branch near line 111).
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
