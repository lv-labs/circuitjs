# New circuit simulator: current plan

Updated 2026-11-16. This is the current plan; [PLAN-HISTORY.md](PLAN-HISTORY.md)
preserves previous milestones and superseded next-task notes.
[HANDOFF.md](HANDOFF.md) contains the current implementation/build/test checkpoint.

## Direction

Build a new editor while preserving CircuitJS's electrical models and simulation
algorithms. KiCad is the interaction reference. Stable document identities and
explicit connectivity must survive a change of frontend.

The agreed starting direction is a **React/TypeScript application in `wires/`,
with shadcn/component libraries for the surrounding UI and an SVG editor sheet**.
The user likes the existing editor's behavior and is not asking for a new
interaction design. Migrate that behavior into an application they can style and
organize themselves: menus, panels, dialogs and symbols in separate components.

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
worker and history/interaction tests remain the portability boundary. The subsequent discussion chose React/SVG as the next starting direction.
`wires/` is still only a scaffold; the migration below has not been implemented.

## Next milestone: migrate the working editor into React

This replaces the earlier frontend-comparison recommendation. Build on `wires/`
and preserve the current sheet behavior. Keep `experiments/engine/editor.html`
working as the complete reference application throughout the migration; do not
replace it with an iframe or copy its large renderer/event-handler file wholesale.
The new sheet should be a real React/SVG view over the existing core.

1. **Prove one-file symbol authoring with the resistor.** A per-symbol TSX file
   should own its stable kind/pin IDs, local pin positions, defaults and applicable
   parameter metadata, plus its React SVG component. Draw the lead endpoints from
   that metadata instead of repeating coordinates in markup. See the contract below.
   Prove a plain data-only catalog can be generated without loading React in the
   computational runtime. Do this for one kind before converting the whole catalog.
2. **Wire the React shell to the core.** Add a focused adapter/hook owning one
   editing/history session, committed document subscription, separate previews and
   simulation lifecycle. Use shadcn/components for toolbars, panels, menus, dialogs
   and forms. Keep styling/tokens separate from electrical/editing behavior.
3. **Render one existing circuit.** Use the saved divider first; add resistor,
   voltage-source and ground symbol components, then capacitor for the RC fixture.
   Use separate sheet, wire, symbol, selection and preview layers. Preserve stable
   React keys, coordinate transforms, upright labels and core-defined hit/snapping
   behavior. Leave the original app available for unsupported symbol kinds; never
   silently discard components from an opened document.
4. **Carry over interactions incrementally.** Pan/zoom, selection, pointer/G drag,
   detached M/rotation/flip, wire creation, floating-end routing, wire-to-pin drops,
   delete and undo/redo must call shared operations. Keep pointer previews local;
   commit once, then notify autosave/simulation. Do not reimplement circuit rules
   in React event handlers.
5. **Connect the real worker and one live measurement.** Reuse the adapter,
   coordinator and transport, including session/revision guards and native live
   updates. Configure Vite/build asset paths for core and compiled worker resources;
   changing the frontend must not require changing solver equations or saved files.
6. **Expand only after that slice works.** Migrate remaining symbols, chooser,
   property forms and scopes in manageable batches. Preserve current behavior and
   make each part easy to style. Measure pan/zoom/drag with simulation running and
   representative scenes; avoid rebuilding the entire SVG scene on every update.

First acceptance checkpoint: the React app loads the existing divider, renders the
same circuit, pans/zooms, selects/drags/rotates, undoes, and shows a correct live
measurement. Existing core checks pass and the reference UI still works. Full
library parity, a visual redesign and a desktop wrapper are not prerequisites.

## Symbol authoring contract

**One authored file per symbol** is the user's chosen direction. A file such as
`resistor.tsx` should co-locate metadata and the React view, so changing the shape,
lead lengths, pin locations or defaults does not require hand-editing another
catalog elsewhere. Proposed location: a reusable `packages/circuit-symbols/src/`
package imported by `wires/`; this package/path and the build tooling do not exist
yet. Keep ordinary UI components under `wires/src/components/` and sheet/layer code
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

Current source locations, before this migration:

- SVG strings: `experiments/engine/editor.js`, `symbol()` (resistor branch near line 111).
- Local pin geometry/defaults: `packages/circuit-core/catalog.js`
  (`basicDefinitions` and `outputSpecs`; resistor definition near line 1163).
- World-coordinate pin transforms: `packages/circuit-core/geometry.js`, `pin()`.
- `wires/src/App.tsx`: starter content only; no circuit sheet or symbol TSX files yet.

A renderer-only edit may change the body, stroke, color and labels freely. Editing
pin positions in the authored definition must change both visible lead endpoints
and core hit/snapping/connection geometry together. Include a regression check for
that relationship rather than drawing a second, independently positioned pin.

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
- Record scope-layout persistence, desktop wrapper/platforms and migration policy
  when decided. React/SVG is the agreed starting direction. Multiple scope panes exist; their arrangement/settings are not a
  final persistent workspace design.
- Preserve accumulated uncommitted work in `new-sim`; no reset, commit, push,
  deployment is implied by a documentation update. Code through `1224f84e` is
  already committed/pushed on `new-sim`; recheck and preserve newer local changes.
