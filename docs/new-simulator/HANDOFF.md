# New simulator: current handoff

Updated 2026-11-16. Read this and [PLAN.md](PLAN.md) first.
[HANDOFF-HISTORY.md](HANDOFF-HISTORY.md) preserves earlier implementation notes,
checks and limitations. Its old “latest” headings, continuation prompts and
batch-specific verification restrictions are not current instructions.

## User direction and immediate next step

The agreed direction is **React/TypeScript in `wires/`, shadcn/component libraries
for the application shell, and SVG for the actual circuit sheet**. The user likes
the working editor experience; they want to style it properly and split its code
into manageable components. This is an incremental React migration of the existing
behavior, not a redesign of wiring/dragging rules.

The user considered Rust/GPUI but now prioritizes fewer runtime language/translation
layers. Keep the JavaScript core and existing simulator. Desktop packaging remains
a later goal; no Tauri/Electron choice or solver port is selected. Canvas is a
possible future renderer only if measured performance warrants it.

The user also chose **one authored TSX file per symbol**, co-locating its metadata
(kind/pin IDs, local pin positions, defaults/parameter metadata) and React SVG view.
For example, `resistor.tsx` should be the place to change the resistor body and
pins. The view must draw its endpoints from that shared metadata. Generate a
plain-data catalog for the core/worker; do not introduce a React/TSX runtime
requirement into the headless package or maintain duplicate handwritten pin data.
This symbol-authoring pipeline has been discussed, not implemented.

**First task tonight:** read [PLAN.md](PLAN.md), inspect current Git changes, then
prove resistor symbol co-location and data-only metadata generation for one kind.
After that, connect a small React SVG divider sheet to the existing editing/core
and worker APIs. Keep the original browser editor running as the behavior reference.
Do not start by porting all 65 symbols or rebuilding the simulator.

## Concrete continuation guide

1. Work in `circuitjs-new-sim` on branch `new-sim`, not the original `circuitjs` checkout.
2. Read the [core API guide](../../packages/circuit-core/README.md) and
   [dragging contract](DRAGGING.md). Confirm existing behavior before changing UI code.
3. Current drawings are in `experiments/engine/editor.js`, the `symbol()` function;
   the resistor SVG is near line 111. Local resistor pins/defaults are in
   `packages/circuit-core/catalog.js` near line 1163. World pin placement is
   `packages/circuit-core/geometry.js`, `pin()`. These are the migration inputs.
4. Proposed new authoring package: `packages/circuit-symbols/src/resistor.tsx`.
   It does not exist yet. The agreed requirement is one authoritative authored
   definition/view per symbol; the exact package/build implementation is still work.
5. Use separate React components for the application shell, sheet, wires,
   symbols, selection/preview overlays, menus, panels and dialogs. A focused hook
   should adapt the shared document/history/simulation sessions to React.
6. First working fixture: the existing saved divider; support resistor, voltage
   source and ground, then capacitor/RC. Preserve saved IDs, pin identities and
   document format. Keep lead drawing and hit/snapping positions in agreement.
7. Carry over the existing interactions and one live measurement, then compare
   against the original app. Add focused checks and migrate other symbols/UI in
   batches. Do not embed the old page in an iframe or create another monolithic
   renderer. [PLAN.md](PLAN.md) records acceptance criteria and remaining decisions.

Start the scaffold separately from the reference app:

```sh
cd ~/Documents/lv-labs/circuitjs-new-sim
pnpm --dir wires install --frozen-lockfile
pnpm --dir wires dev
```

Use the URL Vite prints; it is a separate app from the reference editor on 8765.
`pnpm --dir wires build` verifies its production build. Worker/core asset serving
still needs integration into this Vite app. `wires/src/App.tsx` currently contains
only starter content, so this command does not yet open a circuit editor.

Suggested continuation prompt:

> Read docs/new-simulator/HANDOFF.md and PLAN.md plus the circuit-core README.
> Preserve current local changes. Continue the React/shadcn/SVG migration in wires/,
> retaining the existing editor's behavior and keeping its reference app working.
> Start with one authored resistor.tsx containing metadata/pins/defaults and its
> React SVG view, with a generated data-only catalog consumed by the headless core.
> Keep React out of core/worker runtime dependencies. Then connect a divider sheet
> to the existing commands, history and worker; do not rewrite the simulator.

## Shared-core extraction — 2026-11-16

- Shared catalog, geometry, document validation, history, commands, persistent
  drag engine, compiler/session adapter, revision protocol, simulation coordination
  and sampled-signal state now live under `packages/circuit-core`.
- `index.mjs` is the native ESM entry; `index.js` supports Node/CommonJS and the
  generated classic browser bundle. Metadata/defaults/output schemas are shared;
  native engine post order remains distinct from symbol pin order.
- New editor-session `execute` and `editing.applyCommand` APIs accept frontend-neutral command objects.
  Existing focused model APIs remain available. The old editor/adapter/protocol/
  coordinator/scope entry files are thin compatibility adapters, so the reference
  UI retains its controls, document format and behavior.
- Simulation requires an injected worker transport. The optional browser transport
  forwards session identity through `browserTransport.factory`. Worker bootstrap
  and engine artifact placement remain host concerns.
- Build and cached-build paths package the core. The current UI loads one generated
  core script; fresh frontends can import ESM directly without the renderer/DOM.
- Pre-extraction comparison matched all 65 definitions/defaults/presets/output
  schemas and exact edit/history/compiler snapshots on four saved circuits.
- `node tools/check_core.mjs` passes all 28 computational suites. A new direct-core
  test covers ESM/classic imports, a real DOM-free Node worker, commands/history,
  injected transport and real-engine divider results.
- Full real-browser engine/worker verification passes, including the six saved
  numerical baselines, protocol/fallback lifecycle, continuous runs and scopes.
- Browser checks cover the unchanged reference interactions plus an independent
  ESM consumer editing/simulating a divider without prototype globals. Its native
  value edit retains simulation time/run identity.
- Older browser verification assumptions were made explicit: the candidate-worker
  failure suite negotiates out of native updates to test the existing fallback;
  initial-value edits are tested after an explicit Reset. Runtime policies were
  not changed to satisfy those tests.

## Workspace and source of truth

Work is in the separate `circuitjs-new-sim` worktree on branch `new-sim`.
The neighboring `circuitjs` checkout is `master`; changing Java editor files there
does not change the experimental editor served from `build/engine-site` here.
Code through commit `1224f84e` was committed and pushed to `origin/new-sim`,
including the shared core and `wires/` scaffold. The unwanted early wire-merger
changes in the original `master` checkout were discarded; that checkout was clean
at the commit checkpoint. `wires/` is tracked as ordinary files in the main repo,
not as a nested repository/submodule.

Recheck Git state before working. At this documentation update there are local
changes in `experiments/engine/editor.js`; preserve them. This documentation
checkpoint excludes that local editor edit. Earlier code verification refers to
the committed extraction checkpoint; newer local editor changes were not
revalidated here. Fetch the latest `new-sim` before continuing. Nothing was deployed.

Important runtime files:

- `packages/circuit-core/`: reusable computational package; see its README for
  namespaces, ownership, command formats and a frontend integration example.
- `experiments/engine/editor-model.js`, `document-adapter.js`, `revision-protocol.js`,
  `simulation-coordinator.js`, `scope-model.js`, `revision-client.js`: compatibility
  adapters retaining the prototype globals/defaults, without duplicated logic.
- `editor.js`, `editor.html`, `editor.css`, `scope-view.js`: replaceable input,
  renderer, inspector, persistence and scope DOM.
- `document-worker.js`, `revision-worker.js`, `worker-client.js`: runtime transport
  bootstraps and the older low-level client, using the shared compiler/protocol.
- `EngineEntryPoint.java`, `EngineCircuitUpdate.java`, `EngineOutputSupport.java`
  and existing simulation/model classes: retained Java/GWT engine boundary.

The document, physics behavior, IDs, compiler/worker contracts and regression
fixtures are the durable investment. Keep their behavior while replacing the UI;
there is no requirement to retain every prototype module/API unchanged.

## Implemented checkpoint

- **Engine:** Java/GWT host runs without the legacy UI, including a real dedicated
  worker. Analysis/stamping/model equations remain CircuitJS's. Node harnesses
  execute the generated worker bundle without a DOM shim.
- **Documents:** schema v1, stable component/pin/wire/junction identities, explicit
  connectivity, separate layout and stable-ID results. Canonical electrical
  identity ignores layout and equivalent wire subdivision.
- **Live simulation:** Run is the default. Guarded `updateCircuit` retains existing
  element instances/time/dynamic state for supported same-document value,
  topology and timestep edits. Explicit Reset, another document or fault recovery
  still starts a fresh session. Changes that replace a device's own buffer retain
  their native local-reset behavior. Invalid intermediate edits suspend solving
  without losing Run intent; physical solver faults still need recovery.
- **Catalog:** 65 document/editor models including text/box/line graphics. Menu
  groups currently enabled: passives 13/24, sources 9/17, outputs/labels 20/20.
  Original menu labels/order include disabled pending entries. This is partial
  model/variant parity, not a general importer. See [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md)
  and [LEGACY-CATALOG.md](LEGACY-CATALOG.md) for specific limits.
- **Inspection:** continuous sampled scopes with multiple panes, voltage probes,
  output readings and bounded recorder/audio capture. Scope acquisition survives
  ordinary edits; Reset/document changes retain their intentional reset behavior.
- **Editor harness:** save/open/autosave, transactions/undo, copy/paste, directional
  selection, placement/value editing, source controls and the wiring rules below.

## Latest interaction behavior

[DRAGGING.md](DRAGGING.md) records the source references, API and focused checks.

- The editor normalizes wires into independently selectable straight sections.
  Collinear overlaps within an existing net merge; obsolete turnaround tails are
  trimmed while intentional loose ends and probe anchors are preserved.
- Pointer/G drag uses one persistent `createDragSession` graph, retaining original
  segment directions and temporary bends between updates. X/Y movement and
  reversals are processed separately; compatible corners/adjacent wires slide
  before new segments are added. Fixed branches and pins have distinct rules.
- **Rotation and X/Y flips detach the component, change its pose, then reconnect
  only where the final pins land.** Original visible wire geometry stays put.
  Reorienting during G discards temporary drag wiring and becomes a detached Move
  from the original pickup position. M remains a detached move.
- Clicking a floating wire end starts a new route; dragging it reconnects/moves
  the existing end. Enter finishes loose wiring; Escape cancels the preview.
- Dropping a wire section onto a component pin splits/attaches on commit. An
  interior pin contact gets a three-way junction dot; an ordinary endpoint contact
  connects without a spurious branch dot. Pointer drag and G share this behavior.
- Deleting a component leaves its wires at the old pin locations. Shared branches
  and voltage probes are retained at shared stubs; its current probe is removed.
  Explicitly selected wires still delete normally.
- These operations commit once and undo/redo atomically. Ordinary crossings do
  not connect just because wires overlap; editor drop/draw commands create the
  explicit graph connections. Native KiCad UI equivalence is not certified.

## Verification checkpoint

Recent implementation work passed the following focused model checks, including
96 pin-drag cases, 120 rotation/flip cases, 55 incremental/reversal states and 400
seeded drag offsets. Do not interpret older “all N suites” counts as today's test
inventory or as a full-catalog browser claim.

```sh
node tools/test_drag_session.mjs
node tools/test_pin_drag.mjs
node tools/test_flip_connections.mjs
node tools/test_wire_pin_contacts.mjs
node tools/test_wire_sections.mjs
node tools/test_editor_model.mjs
node tools/test_symbol_orientation.mjs
node tools/test_document_adapter.mjs
```

Actual Chrome pointer/keyboard checks passed for drag/G equivalence, direction
reversal, preview isolation, Escape, rotation/flip with stationary wires, M,
wire-to-pin junctions and exact undo/redo. Floating-end click routing/reconnection
also passed. Scripts:

```sh
node tools/test_drag_browser.mjs /path/to/chrome /tmp/fresh-drag-profile http://127.0.0.1:8765/editor.html
node tools/test_loose_end_routing.mjs /path/to/chrome /tmp/fresh-loose-profile http://127.0.0.1:8765/editor.html
```

Use a fresh profile for each run. Script arguments are browser executable,
temporary profile, URL and optional screenshot path. Other older browser runners
have not all been updated/revalidated against the latest interaction contracts.
These focused checks do not certify the complete component palette or all browsers.
The single computational entry command is now `node tools/check_core.mjs`.

A full `makeEngineSite` Java/GWT build passed during the drag replacement. Later
JS-only changes were packaged with its existing compiled engine/worker artifacts;
no additional Java changes were needed. The extraction also passed a fresh full
Java/GWT/site build and repackaging. Those checks describe that code checkpoint,
not newer local editor changes or the planned React migration.

## Build and run

Use this worktree, not the neighboring legacy checkout. Java 8, the Gradle 8.7
wrapper, cached/downloadable dependencies, Python and modern Node are required.
The current local session uses the following temporary JDK/cache; they are not
repository dependencies and may need replacing on another machine:

```sh
cd ~/Documents/lv-labs/circuitjs-new-sim
export JAVA_HOME="/private/tmp/circuitjs-jdk8/zulu8.98.0.111-ca-jdk8.0.512-macosx_aarch64/Contents/Home"
export GRADLE_USER_HOME="/private/tmp/circuitjs-gradle"
./gradlew makeEngineSite --console plain
python3 -m http.server 8765 --bind 127.0.0.1 --directory build/engine-site
```

Open [the editor](http://127.0.0.1:8765/editor.html). No server is guaranteed to be
running; temporary verification servers have been stopped. Sandbox Gradle failures
opening local coordination sockets can require running the build outside that
sandbox. `tools/build_engine_cached.py` is an offline fallback when the required
GWT jars and a local JDK already exist; it does not fetch dependencies.

Generated `build/` output and browser local autosave do not travel through Git.
Save/Open JSON transfers designs. Source, tests and documentation must be committed
and transferred deliberately before moving machines; do not assume current local
changes have been published.

## Reading order and remaining limits

1. [PLAN.md](PLAN.md): agreed React/SVG direction, one-file symbol contract and next milestone.
2. [DRAGGING.md](DRAGGING.md): implemented geometry/interaction rules.
3. [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md), [COORDINATOR.md](COORDINATOR.md),
   [WORKER-PROTOCOL.md](WORKER-PROTOCOL.md), [RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md):
   implemented contracts, with later updates superseding their initial slices.
4. [EDITOR-DESIGN.md](EDITOR-DESIGN.md), [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md):
   document ownership/design and the reference UI. Older dated checkpoints remain
   history where explicitly marked.
5. [LEGACY-CATALOG.md](LEGACY-CATALOG.md): supported versus pending library entries.

No general legacy text importer/example chooser exists. Bus/hierarchical objects
and many original variants remain outside the current document model. Large-scene
performance, broad browser/platform coverage, workspace/scope-layout persistence
and desktop packaging remain open. The shared-core extraction is implemented;
the agreed next work is the incremental React/SVG migration described above.
The existing behavior tests and simulator remain the reference throughout.
