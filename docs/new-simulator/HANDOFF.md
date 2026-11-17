# New simulator: current handoff

Updated 2026-11-16. Read this and [PLAN.md](PLAN.md) first.
[HANDOFF-HISTORY.md](HANDOFF-HISTORY.md) preserves earlier implementation notes,
checks and limitations. Its old “latest” headings, continuation prompts and
batch-specific verification restrictions are not current instructions.

## User goal and implementation contract

The goal is to **migrate the whole existing editor into the React/TypeScript app in
`wires/`, preserving the old app's behavior and interaction details while making
the presentation easier for the user to style**. This means a real React/SVG
implementation of the editor, menus, dialogs, property forms, scope and simulation
controls. Do not embed the old app in an iframe, redesign interactions, or stop at
the current prototype slice. Keep `experiments/engine/editor.html` working as the
behavior reference until parity is complete.

The agreed stack is React/TypeScript in `wires/`, shadcn/component libraries for
the shell, SVG for the sheet, and the existing JavaScript core plus CircuitJS
worker/solver. Styling should remain separable from behavior through React
components, semantic classes and tokens; do not port the old stylesheet wholesale.
The user chose one authored TSX file per symbol, co-locating symbol metadata and
its React SVG view. Generate plain-data catalog sections for the headless
core/worker; never add React/TSX to their runtime or duplicate handwritten pin
geometry.

## Full-app migration plan and current priority

Keep a feature-by-feature parity inventory against `experiments/engine/editor.js`,
`editor.html`, `editor.css`, `scope-view.js`, `scope-model.js`, and the component
menu/property-dialog modules. For each feature, identify the old behavior and
source, implement it in React using the shared core, then record whether it has
been checked. Build in these groups:

1. **Shell and commands:** File/Edit/View/Add menus; New/Open/Save/autosave and
   examples; undo/redo, clipboard, duplicate, delete, transform, view/grid and
   tool commands; retain only Start/Stop/Reset as always-visible simulation
   buttons.
2. **Sheet parity:** camera/zoom/fit, selection feedback, shortcuts, component
   placement and previews, switches/momentary controls, drag/move/rotate/flip,
   wire routing/reconnect/segment editing, probes, junctions and deletion rules.
3. **Library and properties:** every supported catalog entry and variant, chooser
   taxonomy, authored React symbol views, component-specific properties/validation,
   meter/output readings, variable controls and capture actions. Keep unsupported
   models explicit; do not silently drop document content.
4. **Scopes and simulation:** match the old scope controls, trace scaling, cursor,
   channels, panes, sampling cadence and run-state behavior; preserve the existing
   solver, worker protocol, recording and audio behavior.
5. **Parity and transition:** compare representative circuits and workflows
   against the reference app, fix discrepancies, then make React the sole active
   frontend. Retire the old UI only after the user confirms the migration is
   complete.

Current status: React is active in `wires/src/App.tsx`; it is not an iframe. The
React app already has broad editor interactions, menus, basic file actions,
simulation integration, probes, a multi-pane scope and capture controls. These are
partial ports, with whole-app browser verification still pending. All 84
supported symbols now have authored TSX views. The user says scope pacing is
now better.

Important scope regression found and fixed: the old editor configures the
coordinator with `batchSteps: 10, intervalMs: 16`; React had inherited the core's
default 128 steps per tick, so simulated time advanced 12.8x faster. React now uses
the old settings and feeds scope acquisition from `onFrame`, like the old app.
The sample-channel schema mismatch that previously blanked React is also fixed.

Continue one coherent parity slice at a time, but keep the full-app goal in view;
do not defer whole feature groups indefinitely. Preserve the user's shell, styling
and uncommitted work. **Do not use browser tools unless the user requests them.**
For UI failures, start with the console error the user supplies. Use TypeScript and
focused build checks; do not run tests unless asked to verify or test. No
subagents are needed.

### Startup debugging follow-up

The current main entry is `/src/main.tsx`, which mounts the React app and has a
root error boundary. The latest blank-page error supplied by the user was
`sample channel: unexpected or missing fields`: display labels and pin-reference
wrappers were passed into the strict worker sample-channel API. The React boundary
now maps these to the exact `{id, positive, negative}` terminal descriptors. Do
not reintroduce temporary dynamic-import diagnostics in `wires/index.html`.

## React migration implementation status — 2026-11-17

The React sheet uses the full workspace width. Double-click or E opens a shadcn
properties dialog with live readings, capture actions and meter plotting where
applicable. Probe names can be edited from the same shortcuts on a probe label.
Placing a variable voltage source or potentiometer opens the draggable shadcn
Sliders card and keeps focus on the sheet. View → Sliders and Open sliders in
component properties can also open it. Reorder controls with their grips or the
Up and Down arrow keys. The main editor remembers each circuit's slider order
locally. Edit Slider label in component properties to save its name with the
circuit. Older potentiometers without a label display as Potentiometer. Sliders
preview live and commit on release as undoable edits. The potentiometer wiper
moves during the preview and its wire connection stays fixed. Visible buttons,
menus and form controls use shadcn Base Mira.

The [React parity inventory](REACT-PARITY.md) maps the JavaScript reference to the
current React implementation. The port includes File/Open example and
autosave feedback, command and gesture parity fixes, the reference component
menu hierarchy, the modal property editor, and scope refresh during paused
edits. The standalone preview uses its selected fixture independently of the
main app's autosave. `pnpm --dir wires build` passes with a Vite chunk-size
warning. Headless rendering checked the wiper across the slider range and
confirmed that older unlabeled circuits still render. The engine projection
stays the same after a potentiometer label edit. Browser interaction checks
remain pending.

The symbol port covers all 84 supported models, including graphics. Each
`packages/circuit-symbols/src/<kind>.tsx` owns the React SVG, pin geometry,
defaults and applicable presets or output fields. The generated
catalog extends the original 65 models. The 19 additions cover native sources,
logic, passives and
semiconductors. Each ran and accepted a live circuit update in the compiled
worker. Browser checks of appearance, placement, and live indicators are pending.
Audio and data import and export workflows are deferred for redesign.

`wires/src/editor/CircuitEditor.tsx` and `CircuitSheet.tsx` currently implement the
React shell, File/Edit/View/Add menus, common shortcuts/editing gestures, wire
routing, placement, probes, property dialogs, simulation controls, JSON persistence and a
multi-pane scope. `useCircuitSession.ts` owns the shared core session and worker.
These features are under active parity work. The last reported discrepancy was scope pace;
the coordinator cadence now matches the old editor (10 steps/16 ms), and the user
reported that the result feels better.

Keep `/editor.html` available as the standalone preview and keep
`experiments/engine/editor.html` intact as the complete reference. See the plan
above for the remaining migration groups and acceptance direction.

The cached Java/GWT build worked with the installed Corretto 8 JDK. This sandbox
required in-process compilation:

```sh
JAVA_TOOL_OPTIONS='-Dgwt.jjs.permutationWorkerFactory=com.google.gwt.dev.ThreadedPermutationWorkerFactory' \
  python3 tools/build_engine_cached.py \
  --java-home /Library/Java/JavaVirtualMachines/amazon-corretto-8.jdk/Contents/Home
pnpm --dir wires dev
```

Next: continue the React parity work using the plan and reference editor.
Recheck Git state because the user is editing concurrently.

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
The shared core, React editor, symbol registry and worker sources live on the
`new-sim` branch and use `origin/new-sim` for transfer between machines.
`wires/` is tracked directly in the main repository.

Recheck Git state before working. The user is actively editing `wires/src/App.tsx` and menu components. Preserve
those changes alongside the new React slice; the earlier `editor.js` local-change
note is stale. Nothing was deployed.

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
- **Catalog** includes 84 document/editor models, including text, box and line
  graphics. The original menu labels and order include disabled entries for
  pending models. See [PLAN.md](PLAN.md) for menu counts and
  [LEGACY-CATALOG.md](LEGACY-CATALOG.md) for model and import coverage.
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

After checking out `new-sim` on another machine, build the worker, then run
`pnpm --dir wires install --frozen-lockfile` and `pnpm --dir wires dev`.
See the [React editor README](../../wires/src/editor/README.md) for the preview
entry point and build commands. Use Save/Open JSON to transfer designs between
machines. The worker build and browser autosave are local.

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
