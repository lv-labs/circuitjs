# Circuit core

Reusable document, editing and simulation code extracted from the reference editor.
No renderer, inspector, component menu, DOM events, browser storage or UI toolkit is
required. The package uses the existing schema-v1 saved document and existing
CircuitJS engine/worker protocol. This is an extraction, not a physics rewrite.

## Import

Native ESM, including browser modules and modern Node:

```js
import {catalog, geometry, editing, adapter, simulation, browserTransport}
  from './packages/circuit-core/index.mjs';
```

CommonJS: `require('./packages/circuit-core')`. There are no npm dependencies or
installation step. Browser module imports use the same source files as Node.
Classic-script consumers load the generated `core/browser.js` asset built by
`makeEngineSite`; `globalThis.CircuitCore` exposes the same namespaces. Classic
modules register in `CircuitCoreModules` internally; consumers should use the
public package entry, not that implementation registry.

The optional browser transport creates a Worker only when called. The rest of the
package neither constructs a Worker nor reads `window`, DOM or storage. Modern
`structuredClone` and `crypto.randomUUID` are runtime requirements, as before.

## Ownership and modules

| Namespace / source | Responsibility |
| --- | --- |
| `catalog` / `catalog.js` | All 65 component definitions, stable pin names/positions, defaults, placement presets, output field schemas and legacy mapping metadata |
| `geometry` / `geometry.js` | Grid/world-coordinate transforms, routes, bounds, hit testing, selection geometry and probe reference helpers |
| `document` / `document.js` | Saved graph/layout validation and empty schema-v1 document creation |
| `history` / `history.js` | Generic transactional snapshots, bounded undo/redo and change notifications |
| `editing` / `commands.js` | Circuit-specific commands, contact resolution, normalization, deletion, copy/paste and editor document/history sessions |
| `drag.js` | Persistent drag graph; its command dependencies are supplied by `commands.js` rather than importing UI code |
| `adapter` / `adapter.js` | Electrical validation/projection, synthetic engine input, stable-ID result mapping and synchronous engine sessions |
| `protocol` / `protocol.js` | Worker-side revision/session guards and operation dispatch |
| `simulation` / `simulation.js` | Async lifecycle, live updates, Run/Pause and result gating; requires an injected worker factory |
| `signals` / `signals.js` | Sample history, channel identity, envelopes and scale calculations; no scope DOM |
| `browserTransport` / `browser-transport.js` | Optional request/reply Worker transport with timeouts and session identity |

Symbol SVG, menus/palette order, forms, camera event handling, autosave and HTML/CSS
stay in `experiments/engine`. Legacy files such as `editor-model.js`,
`document-adapter.js`, `scope-model.js`, `revision-protocol.js`,
`simulation-coordinator.js` and `revision-client.js` are compatibility adapters.
Their old globals remain available to the reference UI; new frontends do not need
those adapters.

`catalog.definitions[kind].pins` describes display/world pin geometry.
`catalog.simulationModels[kind].postOrder` separately preserves native engine post
order, which can differ (voltage sources and flip-flops, for example). Do not
infer native current direction or post order from a symbol's object-key order.
Output field schemas/defaults have one owner, shared by editing and compilation.
Basic model defaults are catalog metadata; document validation and stricter engine
validation retain their distinct existing responsibilities. No new complete
form-generation schema has been invented in this extraction.

Catalog metadata is shared and read-only by contract: clone defaults before editing.
Saved documents belong to the caller. Mutable solver state belongs to its engine
session; frames/results are separate from saved circuit JSON.

## Edit with history

```js
const editor = editing.create(savedDocument, (document, label) => {
  // Render and/or submit the committed document. Persistence is the host's choice.
}, {wireSections: true});

editor.execute({
  type: 'transform',
  selection: [{kind: 'component', id: 'r1'}],
  dx: 32,
  dy: 16
});
editor.undo();
editor.redo();
const savedAgain = editor.document; // detached snapshot
```

An immutable one-shot operation is also available:

```js
const rotated = editing.applyCommand(savedDocument, {
  type: 'transform',
  selection: [{kind: 'component', id: 'r1'}],
  rotation: 90
});
```

`applyCommand` returns an updated document without changing its input. `execute`
applies one command to the session and records one undo transaction. Unknown
commands and invalid edits throw before replacing the session's document.

Commands:

- `addComponent`: `kind`, `x`, `y`, optional `rotation`/`mirror`.
- `connect`: `from`, `to`, optional `bends`; the established pin/junction/wire/point
  target objects remain unchanged.
- `remove`: `selection` of `{kind,id}` entity references.
- `transform`: `selection`, optional `dx`/`dy`, `disconnect`, `rotation`,
  `orientations` (e.g. `[{axis:'x'}]`). Rotation and flips leave old wires in place.
- `moveSegment`: `wireId`, optional `segment`, `dx`/`dy`.
- `reconnect`: `junctionId`, `target`.
- `setParameters`: `componentId`, a `parameters` patch.
- `replace`: complete `document` (also suitable for committing a drag snapshot).

The existing focused APIs (`addProbe`, `copySelection`, `pasteSelection`,
`connectContacts`, `transaction`, etc.) remain exported. This boundary does not
require translating every existing operation into a new command format.
`editing.create` retains the old `wireSections:false` default for computational
compatibility; new frontends should opt into normalized sections as above.
`applyCommand` defaults to `wireSections:true`.

## Preview and commit a drag

```js
const drag = editing.createDragSession(editor.document,
  new Set([geometry.token('component', 'r1')]));
const preview = drag.update(32, 16); // absolute offset from pickup, in world units
// Render preview only; do not send it to history/autosave/simulation.
editor.execute({type: 'replace', document: drag.finish()});
// Or discard with drag.cancel().
```

Wire-section sessions accept `{wireId, segment}` as their third argument. Finishing
resolves dropped-wire pin contacts and cleans up temporary geometry. Reversals,
corner constraints, detached orientation and intentional loose ends retain their
existing behavior; see [DRAGGING.md](../../docs/new-simulator/DRAGGING.md).

## Use the retained simulation

The adapter can compile independently of an editor:

```js
const compiled = adapter.compile(savedDocument);
const synchronous = adapter.createSession(existingCircuitEngine);
synchronous.loadDocument(savedDocument);
const frame = synchronous.step(10);
```

For a browser worker hosted with the existing engine site:

```js
const run = simulation.create({
  autoRun: false,
  workerFactory: browserTransport.factory({
    url: new URL('/revision-worker.js', location.origin)
  }),
  onFrame: frame => { /* render stable-ID results */ }
});
await run.setDocument(editor.document);
await run.step(10);
await run.dispose();
```

`factory` forwards the coordinator's session ID and failure callback correctly.
A custom `workerFactory(options)` must return an object with matching `sessionId`,
`ready`, `request(operation, options)`, and `terminate()`. The readiness reply
contains negotiated capabilities. Browser transport location is explicit so a new
frontend can choose its worker/assets location; worker bootstraps and compiled
Java/GWT artifacts remain runtime host/deployment concerns, not document state.

Revision guards, state-preserving native edits, reset/fault recovery and sample
DTOs are unchanged. See the existing worker/coordinator contract docs for details.

## Verify

After building the engine site:

```sh
node tools/check_core.mjs
```

This runs all computational suites, including direct package imports, real Node
worker imports without a DOM, catalog/post-order consistency, command ownership,
undo/redo, solver fixtures, native live edits and signal acquisition. Browser
verification is separate:

```sh
python3 tools/verify_engine.py
node tools/test_drag_browser.mjs /path/to/chrome /tmp/fresh-profile http://127.0.0.1:8765/editor.html
```

The focused browser runner also opens an independent ESM consumer which loads no
prototype renderer/inspector, edits a real divider through `execute`, and runs the
worker while verifying numerical results and state-preserving updates.
