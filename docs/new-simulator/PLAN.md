# New circuit simulator: current plan

Updated 2026-11-16. This is the current plan; [PLAN-HISTORY.md](PLAN-HISTORY.md)
preserves previous milestones and superseded next-task notes.
[HANDOFF.md](HANDOFF.md) contains the current implementation/build/test checkpoint.

## Direction

Build a new editor while preserving CircuitJS's electrical models and simulation
algorithms. KiCad is the interaction reference. Stable document identities and
explicit connectivity must survive a change of frontend.

The current browser/SVG application is a working interaction and integration
prototype, not a commitment to the final UI. The latest user direction is to avoid
investing too much further in it because a fresh UI is intended later. Rust/WASM,
TypeScript, target platforms, toolkit and final repository layout remain undecided.
The user has authorized the shared-core extraction below; it is now implemented.
No UI rewrite, toolkit selection or engine port has been selected.

## Current checkpoint

| Area | Implemented | Still open |
| --- | --- | --- |
| Engine boundary | Editor-free Java/GWT engine, dedicated worker, bounded stepping and stable-ID results | Full legacy compatibility, larger-circuit performance and broader platform verification |
| Continuous editing | Default Run; guarded in-place value/topology/timestep updates retain existing model state and engine time | Unsupported configuration/model variants; exhaustive behavior across the entire legacy library |
| Document boundary | Schema v1, explicit graph, stable IDs, canonical electrical projection, save/open | Schema migration policy; further separation only when a concrete frontend requires it |
| Library | 65 document/editor models, including 3 graphics; original model equations reused | Full component/variant coverage; menu availability is not import compatibility |
| Prototype interactions | Stateful connected dragging; section merge/tail cleanup; detached rotation/flip; wire-to-pin drops; loose-end routing; preserved wires on component deletion | Full native KiCad equivalence; reusable interaction modules are now extracted |
| Signal inspection | Worker samples, voltage probes, multiple scope panes, output measurements/capture | Broader performance/platform coverage and final UX/layout decisions |
| Legacy import | Source inventory and coverage mapping | No general legacy text importer or bundled-example chooser |

Current menu availability, checked against code on 2026-11-16: Passive Components
13/24; Inputs and Sources 9/17; Outputs and Labels 20/20. These are menu counts,
not independent model or fully supported variant counts. See
[LEGACY-CATALOG.md](LEGACY-CATALOG.md) and [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md).

## Shared-core extraction — completed 2026-11-16

The reusable code now lives in [packages/circuit-core](../../packages/circuit-core/README.md):
shared catalog/pin/default metadata, geometry, document validation, history,
commands and drag graphs, compiler/session adapter, revision protocol, simulation
coordination and sampled-signal state. Native ESM and classic/Node entry points
share the same implementation. The reference UI uses compatibility adapters.

A standalone consumer imports only this package, edits a divider and drives the
real retained worker without the prototype renderer/inspector. The numerical,
worker and history/interaction tests remain the portability boundary. This is not
a final UI stack decision, and no new UI was built.

## Recommended next milestone: a small fresh frontend comparison

Steps 1–3 below describe the now-completed extraction/checkpoint. The next proposed
implementation is step 4: one small vertical slice. Defer additional cosmetic work
on the old shell; retain it as a behavior/reference harness.

1. **Define the reusable boundary.** Document the contract for a circuit document,
   component/pin metadata, edit commands and drag sessions, undo transactions,
   simulation requests/results and sampled signals. Distinguish electrical pin
   geometry from SVG symbols and DOM input handling. Reuse existing APIs where
   they are sufficient; avoid inventing a large abstraction layer.
2. **Separate and verify that boundary.** Move reusable catalog/geometry/command
   code out of the prototype shell incrementally. This is now implemented in the
   shared package; `editor-model.js`
   and the old adapter entry points delegate to it. Keep metadata/commands shared
   instead of duplicating them in the next frontend. Document IDs/formats and
   engine behavior remain unchanged.
3. **Checkpoint portability.** Maintain one repeatable check command plus saved
   fixtures for divider/RC simulation, live edits, wires/junctions, drag/cancel,
   detached rotation/flip, wire-to-pin connection, undo/redo and save/open. Keep
   numerical/worker tests independent of browser UI tests. The old editor becomes
   the reference harness that exercises the same core.
4. **Then compare frontend candidates with one small vertical slice.** Build/open
   the same saved divider or RC circuit, place/connect a component, perform a
   connected drag and detached rotation, undo, and plot a probe using the existing
   worker. Compare input/text handling, trackpad/high-DPI behavior, accessibility,
   implementation effort and packaging. Choose the stack from evidence before
   building a replacement full application.

Exit: a new frontend can load/edit/simulate the same document and run the core
regressions without importing the old `editor.js`, SVG renderer or inspector.
The aim is to replace the UI shell while retaining validated domain behavior.
Full component parity and legacy import are not prerequisites for starting that
fresh frontend slice.

## Library work after the boundary checkpoint

Full Falstad library coverage remains a goal. The earlier order was components
before legacy import, with remaining passives later deferred in favor of Variable
Voltage and Outputs/Labels; that requested slice is complete. There is no newly
approved next component family.

Choose a bounded next batch using catalog/example usage and required environments.
For instance, remaining source entries include sweep, antenna, AM/FM, noise, audio
input, data input and external JavaScript voltage. They are not equally cheap:
external input/audio require capabilities and lifecycle decisions beyond another
numeric device mapping. Pending passive and digital families remain recorded in
the catalog; do not infer that an enabled menu entry supports every legacy variant.

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
- Record scope-layout persistence, target platforms, toolkit and migration policy
  when decided. Multiple scope panes exist; their arrangement/settings are not a
  final persistent workspace design.
- Preserve accumulated uncommitted work in `new-sim`; no reset, commit, push,
  deployment is implied by the extraction. The core is implemented; a fresh UI
  comparison remains proposed work.
