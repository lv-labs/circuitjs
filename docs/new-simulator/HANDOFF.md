# New simulator: current handoff

Updated 2026-11-16. Read this and [PLAN.md](PLAN.md) first.
[HANDOFF-HISTORY.md](HANDOFF-HISTORY.md) preserves earlier implementation notes,
checks and limitations. Its old “latest” headings, continuation prompts and
batch-specific verification restrictions are not current instructions.

## User direction and immediate next step

The user is happy with recent interaction fixes but is cautious about spending
more time on the current UI because they intend to start fresh later. The current
SVG/browser editor remains an interaction/reference harness. No final UI toolkit,
language or target platform has been chosen; Rust/WASM remains an option, not a
requirement or authorization to port the solver.

The user authorized step 1 (extract reusable code while preserving the UI). It is
implemented in [packages/circuit-core](../../packages/circuit-core/README.md).
The next proposed work is a small fresh frontend comparison using that package;
no replacement UI/toolkit or additional component family has been selected.

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
Recheck Git state before working. There is substantial accumulated uncommitted
Java, JS, test, fixture and documentation work. Preserve it; this session did not
commit, push or deploy it.

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
no additional Java changes were needed. The built site matches the current editor
sources. The extraction also passed a fresh full Java/GWT/site build and repackaging.

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

1. [PLAN.md](PLAN.md): current direction and recommended UI-independent next milestone.
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
and a replacement frontend comparison remain open. The shared-core extraction is now implemented. Further component expansion and a
fresh UI remain separate future tasks; preserve this package and its checks.
