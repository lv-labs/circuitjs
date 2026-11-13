# New simulator: handoff

Updated: 2026-11-13. New-simulator development lives on `new-sim`, branched from
`c2cd5dc2` (`added 404`). Source, docs, fixtures and tests are included in the
prototype commit. The dedicated worktree is `../circuitjs-new-sim`; the original
`circuitjs` checkout remains on `master`. Nothing was deployed. Recheck Git state
and remote tracking before continuing; do not reset the checkout based on this note.

## User direction and reading order

Build a modern editor while retaining CircuitJS's proven simulation implementation.
Interaction quality is the priority. The user wants KiCad-like placement, selection,
wiring and dragging. Rust/WASM inspired the project, but language, UI toolkit,
browser/desktop targets and repository layout remain undecided. The current
browser/SVG editor is an interaction prototype, not a final toolkit choice.

Read applicable repository instructions, the root [README](../../README.md),
[PLAN.md](PLAN.md), then the document relevant to the task:

- [PHASE-0.md](PHASE-0.md): editor-free engine, toolchain, numerical references, worker proof.
- [EDITOR-DESIGN.md](EDITOR-DESIGN.md): graph, IDs, transactions and proposed broader scope.
- [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md): implemented document catalog/compiler/results.
- [WORKER-PROTOCOL.md](WORKER-PROTOCOL.md) and [COORDINATOR.md](COORDINATOR.md): versioning, replacement, reset and failures.
- [RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md): continuous run/pause and FIFO RC switching.
- [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md): controls, current contact/drag rules and limitations.

## Implemented boundary

The Java/GWT engine runs without the old editor in a browser entry point and a real
dedicated worker, with no window/document shims. Analysis, stepping maths and
component models remain CircuitJS's. No solver rewrite was performed. Six numerical
fixtures cover divider, backward-Euler RC, trapezoidal RC, RLC, diode rectification
and timed SPST switching. Chrome worker execution is verified; other browsers,
Node engine runtime and full-model compatibility are unproven.

The separate schema-v1 document adapter supports resistor, capacitor, DC source,
SPST switch and ground. Inductor/diode fixtures exercise the legacy text API, not
the new document catalog. Documents have stable component/pin/junction/wire IDs,
explicit graph edges and separate layout. Synthetic CircuitJS coordinates are
private compiler output. Canonical electrical identity ignores layout and graph
subdivision. Results map back to stable IDs with normalized source-current signs.

The coordinator gates requests/frames by session, revision and epoch. Layout-only
changes reuse the worker; electrical edits prepare/activate a replacement and
restart at initial state. Failed candidates preserve the previous engine. Reset
uses the latest committed document. Continuous Run/Pause uses bounded batches;
acknowledged pause waits for in-flight work. A single supported switch-only commit
is FIFO-applied between batches, preserving time, capacitor charge, worker and
epoch. Other electrical edits stop running and replace/reset. Unsupported ideal
loops/floating islands are rejected before live mutation. Adaptive pacing, broader
live edits and general checkpoint transfer are not implemented.

Emit one physical engine ground and alias public ground IDs to it. Multiple
GroundElm records with synthetic hub wires create a legacy wire-loop error.
Candidate activation checks load/analysis; a later numerical failure still needs a
new run, rather than automatic rollback to a previously retired worker.

## Editor and latest completed fixes

`/editor.html` supports placement, click/Shift/box selection, connected group
dragging, manual wiring/bends, explicit junction splitting, segment rerouting,
rotation, pan/zoom, undo/redo/delete, SI value editing, live switch toggles,
run/pause/step/reset, local autosave and JSON Save/Open. Incomplete designs remain
editable while their worker diagnostic explains why simulation cannot start.

Latest pass, completed at the user's request:

- Removed visible pin circles and ordinary two-way join dots. Filled dots mark
  connected branches with at least three incident component leads/wire legs.
- All supported pins align to the 16-unit grid at every rotation. Ground's lead
  offset is 32 units, and its connection pin anchors placement/preview. Older
  autosaves/imports snap layout to the grid without inferring electrical edges.
- Placing/rotating/dropping a pin onto a pin, junction or unconnected wire records
  explicit contact edges/splits in the same undo transaction. Crossings alone do
  not connect. Import/rendering never derives new connections from overlap.
- A ground placed on a resistor pin creates a hidden zero-length contact edge.
  Dragging it away reveals a wire while preserving the same electrical graph.
- Attached route legs follow moving endpoints instead of keeping stale waypoints.
  Collinear redundant bends and out-and-back spurs are removed. This is local route
  adjustment; it does not implement obstacle avoidance or general loop cleanup.
- Endpoint identity comparisons use canonical typed tuples, independent of JSON
  property order. Hidden contact edges are excluded from the visible wire count.

Main editor files: `experiments/engine/editor-model.js`, `editor.js`, `editor.html`,
`editor.css`; geometry/history tests: `tools/test_editor_model.mjs`.
Worker files and API details are indexed by the linked boundary docs. Java changes
are confined to the editor-free host/build/initialization/stepping hooks described
in PHASE-0.md; this latest interaction pass changed no Java numerical code.

## Verification at handoff

Passed after the contact/drag changes:

```sh
node tools/test_editor_model.mjs
node tools/test_document_adapter.mjs
node tools/test_simulation_coordinator.mjs
node tools/test_continuous_simulation.mjs
./gradlew makeEngineSite --console plain --no-daemon
python3 tools/verify_engine.py --output /tmp/engine-results.json
```

The combined Chrome suite passed all 27 check groups, including six reference
fixtures (pin voltages/currents within absolute tolerance 1e-12 of unchanged
CircuitJS), worker isolation/heartbeat, stable-ID documents, stale-request/frame
gating, failed replacement, pause/resume and state-preserving RC switching.
The normal `makeSite` build passed earlier in this work; no Java/build changes
were made in the latest editor-only pass.

New pure tests cover every model/rotation's grid pins, ground-at-cursor contact,
contact-to-straight-wire dragging with unchanged canonical projection, duplicate
prevention, atomic undo, dropped-pin wire splitting, branch dots and backtracking.
Earlier real pointer/keyboard checks covered selection/group dragging, wiring and
branching, rerouting/undo, pan/zoom, values and live simulation. Latest browser check
confirmed removed terminal circles and ground placement directly onto a resistor
pin. Browser automation's drag method failed before dispatching input, so the new
ground-drag case is verified by the pure model test, not a successful new browser
drag. Temporary test placements were undone; the user's existing six-part autosave
was preserved and left paused. Generated preview: `build/editor-preview.jpg`.

Pure coordinator tests additionally cover races, rapid FIFO edits, invalid and
duplicate requests, failed reset, disposal, worker death and re-entrant observers.
Use sequential browser-suite/preview checks when diagnosing timing: one earlier
concurrent run timed out; standalone reruns passed. There is no large-scene UI
performance claim from this small prototype.

## Next concrete task and remaining limits

Design a separate Move command versus wire-preserving Drag, using KiCad as the
interaction reference. Decide explicit disconnection/cleanup and undo semantics
before implementation. All current component pointer drags preserve attached
wires. Then add inline component insertion/wire cleanup: placing a two-pin part
across an existing wire currently does **not** remove the bypass wire segment.

Other open work: directional box selection, copy/paste, dedicated wire-end
reconnection, obstacle routing, touch/accessibility/full keyboard navigation,
component search, richer waveforms/probes, CircuitJS import, broader model catalog,
large-circuit profiling and a second frontend comparison before choosing a toolkit.
The renderer rebuilds SVG children per update. Logical component-ID double-click
handling and root-SVG pointer capture prevent transient-child identity problems.
The editor validates layout for its five models; do not claim complete future-schema
or general probe validation in the worker adapter.

## Reproduce and continue at home

Requirements: Java 8 JDK, Gradle 8.7 wrapper dependencies, Python 3.9+, Node 22+
(built-in WebSocket) and Chrome/Chromium. Set `JAVA_HOME` to the local Java 8 JDK.
This machine used a temporary Zulu JDK and Gradle cache under `/tmp`; they are not
part of the repository and must not be assumed available on another machine.
Saved numerical references in `experiments/engine/reference.json` avoid needing
the old app baseline directory for routine tests.

Build/test with the commands above, then:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory build/engine-site
```

Open http://localhost:8765/editor.html. Other demos: `/document.html`,
`/coordinator.html`, `/continuous.html` and `/verify.html`. The engine/editor build
is opt-in and does not add this prototype to the normal deployed site.

At home fetch/clone and check out `new-sim` before continuing. Browser
local autosave and generated `build/` output do not travel through Git. Use the
editor's Save/Open JSON for the actual circuit design; save files are schema v1
and include stable IDs, explicit connections, layout and initial conditions.

Suggested continuation prompt:

> Read docs/new-simulator/HANDOFF.md and linked plans plus applicable repository
> instructions. Inspect Git state and run the documented checks. Continue the
> separate Move/Drag interaction design using KiCad as reference. Preserve the
> explicit graph, stable IDs and unchanged CircuitJS simulation behaviour. Rust
> and the final toolkit remain open. Update the docs/handoff with checks, limits
> and one concrete next task.
