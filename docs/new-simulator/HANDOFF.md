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
SPST switch, three-pin op-amp, one-terminal voltage rail and ground. Inductor/diode fixtures exercise the legacy text API, not
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

Separate Move (M) and wire-preserving Drag (G), atomic undo/redo, R rotation and
the searchable A component chooser are now implemented; see EDITOR-PROTOTYPE.md.
Inline component insertion now removes the bypass span on clear straight wires,
including subdivided spans. Next: dedicated wire-end reconnection and cleanup
of rejoined loose wires. Preserve explicit graph IDs, endpoint branches and probes.

Other open work: directional box selection, copy/paste, dedicated wire-end
reconnection, obstacle routing, touch/accessibility/full keyboard navigation,
component search, richer waveforms/probes, CircuitJS import, broader model catalog,
large-circuit profiling and a second frontend comparison before choosing a toolkit.
The renderer rebuilds SVG children per update. Logical component-ID double-click
handling and root-SVG pointer capture prevent transient-child identity problems.
The editor validates layout for its seven models; do not claim complete future-schema
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
> instructions. Inspect Git state and run the documented checks. Continue
> wire-end reconnection and local cleanup using KiCad as reference. Preserve the
> explicit graph, stable IDs and unchanged CircuitJS simulation behaviour. Rust
> and the final toolkit remain open. Update the docs/handoff with checks, limits
> and one concrete next task.


## Move/Drag continuation, 2026-11-13

Implemented in the dedicated new-sim worktree, with no Java numerical changes:
M detaches boundary connections and leaves wires at their old locations; G stretches
connected wires; R rotates; A opens a searchable component chooser; E focuses
properties; P places ground. Commands use selection or hover, follow the cursor,
commit on click and cancel on Escape. Rotation and destination pin contacts share
one undo transaction. Pointer drags continue to preserve wires. Selected wire Move
is supported; single-wire G reroutes a segment. See EDITOR-PROTOTYPE.md for exact
cleanup rules and limits. Ordinary dangling endpoints intentionally remain.

Baseline: four Node suites, makeEngineSite and all 27 Chrome engine groups passed
before edits. The system Java launcher had no runtime; the temporary Java 8 JDK
and Gradle cache described above were still available. Gradle and browser checks
need local socket access outside this session's restrictive sandbox.

Added tools/test_editor_browser.mjs, invoked with verify_engine.py --editor in an
isolated temporary profile, so it does not touch the user's browser/autosave.
Final verification: all four Node suites passed; makeEngineSite passed; the new
editor browser suite passed all five groups; all 27 engine browser groups passed.
One final engine attempt stopped with CircuitSimulation undefined before coordinator
checks; an unchanged sequential rerun passed all groups. No cause was established;
this is not recorded as a numerical mismatch. Editor visual QA of the chooser and
toolbar passed at 1440×1000. git diff --check passed. Changes remain uncommitted.

Checks for this pass:

```sh
node tools/test_editor_model.mjs
node tools/test_document_adapter.mjs
node tools/test_simulation_coordinator.mjs
node tools/test_continuous_simulation.mjs
./gradlew makeEngineSite --console plain --no-daemon
python3 tools/verify_engine.py --editor --output /tmp/editor-results.json
python3 tools/verify_engine.py --output /tmp/engine-results.json
```

The subsequent inline insertion pass below completes this milestone.


## Inline insertion continuation, 2026-11-13

Implemented inline insertion in editor-model.js before pin contact attachment.
The component's two pins bound a straight electrical path; a draft copy splits the
boundary wires, finds the path, rejects protected interior branches/pins/probes
or ambiguous spans, removes the bypass and folds newly created cut junctions into
the component endpoints. Ordinary intermediate junctions and deleted layout entries
are removed locally. Existing endpoint junctions and unrelated crossings survive.
Placement, Move/Drag drops and rotation share this operation and their existing
atomic undo/redo. UI handlers catch rejected insertions and show the reason without
committing a document or history entry. All supported two-pin models/rotations are
covered; no Java numerical code changed. No global graph simplification was added.

Expanded model and editor browser checks cover the cut, cleanup, rejection and
undo behavior. The browser test also runs a real worker on a divider with an
inserted 1 kΩ resistor and verifies 5/3 V output and 5/3000 A current. Temporary
profiles isolate these checks from the user's running editor/autosave.

Final verification: all four Node suites, makeEngineSite, all seven editor browser
groups and all 27 engine browser groups passed. Two engine attempts timed out;
live inspection showed the verification page complete but verify.js/report absent.
The test HTTP server accept queue was increased from its default to 128 to
accommodate parallel Chromium script preloads; the next engine run passed. This
observed recovery does not establish that every historical timeout had that cause.
Editor visual review and git diff --check passed. Generated build/engine-site is
updated for the existing preview server; refresh editor.html. All changes remain
uncommitted alongside the earlier Move/Drag work.
Next concrete task: dedicated wire-end reconnection, with clear snapping,
branch-versus-crossing behavior and reversible local cleanup when loose ends join.


## Op-amp/editor feature continuation, 2026-11-13

Implemented at the user's request before broader optimization:

- `opamp@1` in the document adapter and editor: minus/plus/out, gain, minOutput,
  maxOutput. Defaults 100000 and ±15 V. Uses unchanged CircuitJS OpAmpElm maths.
  EngineEntryPoint now accepts validated `a` records. OpAmpElm skips its rendering
  font lookup and mouse creation check when the old UI is absent, enabling a real
  worker without window/document shims. Capability negotiation advertises opamp@1.
- X/Y world-axis flips for placement, selection/hover and pending Move/Drag, with
  ordered rotation/flipping and undo. Standalone flips retain graph/pin identities.
- Non-loading voltage markers from Probe or A, attached to explicit pin/junction
  references. Wire targets split atomically; labels store offsets in layout.probes.
  New ground-referenced probe shape coexists with existing differential probes.
- Properties dialog on E/double-click or Inspector button, with draft validation,
  model-specific fields, reference editing, Apply/Cancel and one-step undo.
- Switch bodies single-click to toggle after a 450 ms discrimination delay.
  Double-click opens properties with no toggle; dragging does not toggle.

Added the gain-two fixture docs/new-simulator/examples/opamp-noninverting.json;
makeEngineSite copies it to examples/. The engine verifier now includes
opamp-tests.js. Numerical checks cover feedback, inversion, follower, positive and
negative saturation, output-current sign, reset, worker/main agreement and rejected
invalid loads. Existing six numerical baselines still pass. The browser input
runner now waits for actual reload and SVG readiness to avoid reading the previous
page's ready flag. Temporary profiles preserve the user's editor/autosave.

Verification so far: four Node suites, makeEngineSite, all 28 engine browser groups,
and all 11 editor browser groups passed. Screenshot review confirms triangle/input
signs, tidy controls, and a 2 V probe on the gain-two example. Final modal visual QA
passed: reference, gain/limit fields, validation area and Apply/Cancel fit cleanly. Changes remain uncommitted alongside previous editor work.

Limits: this is a three-pin implicit-supply model, not a powered chip or a specific
manufacturer model. GBW/slew are not simulated by this legacy op-amp. Probe removal
leaves equivalent wire subdivision; no full probe editor or scope UI was added.
Switch live-state preservation remains validated on the previous RC set. Next task
can return to loose wire-end reconnection or expand models per user direction.


## Sine/value-selection/loose-wire continuation, 2026-11-13

At the user's request, added a Sine source placement preset and source waveform
schema with amplitude (peak V), frequency (Hz) and DC offset (V). Its electrical
kind remains voltageSource, so existing source pins/signs, inline insertion and
flips are reused. DC saved documents keep their original shape. All sine fields
are exposed in properties with SI parsing, validation and atomic undo. The legacy
engine already supported sine records; this pass changes no Java/math code.
Capability negotiation now advertises voltageSource:sine@1.

Properties focus/select the full main value immediately for double-click/E and
Inspector editing. Ground/switch fall back to selected reference text.

Wire drafts finish in blank space by double-click or Enter. The endpoint is a
new explicit, snapped junction; a hollow square identifies degree-one junctions.
Start-wire splitting, bends, loose endpoint and wire are one transaction; Escape
leaves no draft edits. Zero-length no-op drafts add no history. Loose ends survive
save/reopen and can start a subsequent wire in Wire mode. Dedicated endpoint-grab
editing and general rejoined-route cleanup are still not implemented.

Added examples/opamp-sine.json (gain-two AC amplifier with output probe) and
sine-tests.js. Numerical checks cover analytic sine values at legacy sample times,
zero amplitude, offsets/frequencies, AC op-amp gain and clipping, reset and worker/
main agreement. New model checks cover loose endpoint graph/snap/reconnection,
save/reopen, zero/invalid drafts and exact undo/redo. Browser checks cover selecting
and replacing the primary value without Ctrl-A, sine fields/validation/undo, both
loose-ending gestures, draft cancellation, reload and reconnection.

Verification: all four Node suites, makeEngineSite, all 29 numerical/browser
engine groups and all 13 editor browser groups passed. Real input checks verify
immediate value replacement, sine field validation/application/undo, and both loose
wire finishing gestures with exact undo/redo, reload, continuation and cancellation.
Visual QA covers the sine symbol, compact three-line canvas values and the modal's
selected amplitude plus frequency/offset fields. git diff --check passed.
Generated build/engine-site is refreshed for the existing preview server.
Existing uncommitted editor/op-amp work is preserved; no deployment is implied.


## AC source / one-terminal continuation, 2026-11-13

Renamed visible Sine source to AC source and added four explicit presets in the
palette/chooser: AC/DC × one/two terminals. Sine document shapes are preserved;
legacy sineSource placement calls alias to acSource. Properties on both models
now select DC, sine, square, triangle, sawtooth or pulse. Square/pulse expose duty
in percent; saved dutyCycle is a fraction. Shared/duty draft values and reference
are retained across waveform changes; Apply is one undo step and Cancel discards.

Added voltageRail@1 with one p pin and a true RailElm engine record. Source/rail
parameters and validation are shared. Pin-anchored placement stays aligned across
rotation/flips. Compiler preflight accounts for implicit reference without requiring
a ground symbol, checks ideal rail/source loops, and keeps actual public pin/current
mapping. EngineEntryPoint accepts validated R and periodic v records, with explicit
pulse duty flag. Existing numerical source/rail/model equations remain unchanged.

Added examples/opamp-ac-rail.json and waveform-tests.js. Model/compiler checks cover
presets, anchor geometry, save/reopen, contacts, waveform/duty validation, worker
projection and loop guards. Real worker/main checks cover all six waveform choices
on both source models, non-default duty, op-amp feedback, reset, implicit reference,
and positive/negative rail load currents. Browser input checks cover naming, all
presets, waveform/duty drafts/validation/cancel/undo and a rail-driven probe update.

Final verification: all four Node suites, makeEngineSite, all 30 engine browser
check groups and all 16 editor browser groups passed. Visual review confirms clear
terminal-count labels, source captions clear of attached wires, the waveform
selector/duty field and the one-terminal square-wave-driven 1.5 V op-amp probe.
The browser runner now waits two animation frames after reload before computing
pointer positions; a loose-reconnection assertion on a rerun passed after adding
that readiness wait. git diff --check passed. build/engine-site is refreshed for
the user's existing preview server. Earlier
uncommitted editor work remains in place; no deployment or commit was requested.


## Oscilloscope continuation, 2026-11-13

Added a bottom Oscilloscope dock for multiple voltage probes. It starts collapsed;
Run/Pause, time/div, Auto/manual shared V/div, channel toggles, latest/min/max and
synchronized hover readings work together. Exactly two visible traces also show
their difference. Clear affects capture only; collapse retains it. Probe names are
editable in Inspector as one undoable annotation change, and probe/trace colors
match by stable ID. Existing differential voltage probes are supported.

Accurate sampling is worker-side per successful electrical step, in one bounded
reply. Adapter step now optionally receives up to 32 validated terminal-pair
channels and returns sampleBatch descriptors/times/voltage arrays plus final frame.
Unsampled behavior stays compatible. Coordinator setSampleChannels snapshots each
request's channel set and applies existing revision/session/epoch/sequence gates.
The editor resolves explicit pin/junction probe references to deterministic public
terminal IDs. No Java or numerical equations changed for this slice.

scope-model.js maintains a 20,000-sample ring per channel, rejects incompatible
identities/targets, and computes display envelopes preserving min/max peaks.
scope-view.js manages the dock/legend/axes/cursor. Capture is transient, not saved
with the circuit. Rename/layout edits preserve history; channel set changes or
reset/replacement/errors clear it. Supported same-epoch live RC switching may
continue after its accepted revision. Missing/excess probe targets are reported.
No trigger/single-shot/current/export modes or general performance claims yet.

Added opamp-oscilloscope.json (named Vin/Vout) and scope-tests.js for real-worker
per-step analytic gain, intermediate peaks/differentials, reset, no hidden steps,
RC integration equivalence and invalid-channel preservation. Pure checks are
node tools/test_scope_model.mjs and node tools/test_scope_sampling.mjs. The browser
input suite covers multi-probe capture, scales/toggles/cursor, clear/Step/reset,
rename/layout retention, probe deletion/undo and fresh runs after source edits.

Final verification: all six Node suites, makeEngineSite, all 31 engine browser
groups and all 19 editor browser groups passed. Visual QA shows two aligned sine
traces at the expected gain of two, matching probe colors/names, shared axes,
min/max and cursor readings. Actual probe-label dragging and collapse/reopen retain
capture. A browser test was corrected to recalculate the toggle position after
collapsing the dock; the final check asserts that it is visibly open. git diff
--check passed. build/engine-site is updated for the current preview server. Earlier uncommitted
work remains preserved and nothing is deployed.


## End-of-day handoff — 2026-11-13

The user is finishing for today. No additional implementation is requested now.
Current stopping point is the working single-dock, multi-probe oscilloscope above.
The last implementation checks passed: six Node suites, makeEngineSite, 31 engine
browser groups and 19 editor browser groups. This closing update changes docs only.
All source, fixtures, tests and documentation remain uncommitted on new-sim; nothing
was deployed. Recheck Git state when resuming and preserve this accumulated work.
Browser autosave and captured scope history do not transfer through Git; use JSON
Save/Open for the circuit itself. Scope capture is transient and is not in that JSON.

### Future request: multiple scope panes (deferred)

The user would like multiple oscilloscope panes, with the option to arrange them
vertically stacked or horizontally side by side. Record this as desired future
work, not authorization to start implementing it automatically on resume.

The current implementation plots multiple probes together in one dock. The future
request is for multiple separate scope views. When the user chooses to pursue it,
first specify probe assignment/grouping, pane creation/removal/resizing, and how
per-pane time/voltage scales and cursors should behave. Linked versus independent
scales/cursors and persistence of the pane layout have not been decided.
Prefer sharing the existing synchronized acquisition across views rather than
advancing the simulator independently for each pane. Preserve the existing run/
revision/target guards and bounded buffers.

Suggested next-session prompt:

> Read HANDOFF.md and the linked editor/worker docs, inspect the current new-sim
> worktree and preserve its uncommitted changes. The single multi-probe scope is
> implemented and verified. Multiple separate scopes stacked or side by side are
> a recorded future request, explicitly deferred at the end of the session. Ask
> what the user wants to work on next before starting another feature.

## Wire endpoints, grid and scope panes — 2026-11-14

User authorized endpoint reconnection/cleanup, multiple scope panes, and a background
 grid. This supersedes the previous deferred-scope instruction. The starting worktree
was clean at 7e0b4e9c, tracking origin/new-sim; earlier uncommitted warnings are historical.

Implemented:
- Select-mode drag of a single degree-one junction picks up its wire endpoint.
  Preview snaps to pins, other junctions and wire interiors, excluding its own wire.
  Release reconnects atomically; Escape/cancel discards the preview. Empty drops
  reposition the loose end. Existing Wire-mode continuation remains available.
- Reconnection removes the redundant source junction, retargets attached voltage
  probes, and normalizes adjacent bends. Interior drops split the destination wire
  explicitly. Existing wire IDs and destination junctions/branches remain intact.
  Two-way graph subdivision is retained deliberately; no global route simplifier
  or obstacle router was introduced. Own-wire/opposite-endpoint joins are rejected.
- Lines/Dots/Off background grid selector, default Lines, aligned with pan/zoom and
  the existing 16-unit snapping. Grid display does not alter snapping/connectivity.
- Up to four scope panes, added with + Pane and individually removable except the
  original pane. Stacked/side-by-side responsive layouts, native vertical resize,
  per-pane channel checkboxes and auto/manual V/div. Shared time/div and cursor;
  one existing bounded acquisition buffer, no extra stepping. Pane/grid settings
  remain session-only, excluded from circuit JSON. Side-by-side wraps on narrow views.

Verification: all six Node suites passed, including new endpoint tests for pin,
loose-end and wire-interior joins, own-wire snap exclusion, stable wire IDs, probe
retargeting, redundant-junction cleanup and exact undo/redo. JS syntax and git diff
--check passed. Added browser regression cases for endpoint drag/cancel/history,
multiple panes, shared capture/cursor, independent channels/scales and grid modes.
These new browser cases have NOT run: local HTTP bind is denied by this sandbox,
and the browser-control tool reports Chrome unavailable. makeEngineSite also could
not run because the Gradle wrapper cache lock is outside writable paths. Existing
compiled engine output was retained and changed frontend assets copied into
build/engine-site for preview. No Java/solver changes, commit or deployment.

Next: run makeEngineSite and the editor/engine browser suites outside the restricted
session, review the multi-pane layout visually, and assess endpoint snapping in use.

## Clipboard, selection and library priority — 2026-11-14

Implemented in editor-model.js/editor.js with toolbar/shortcut additions:
- In-tab copy/paste (Ctrl/Command C/V), duplicate (Ctrl/Command D), cursor preview,
  click placement and cancellation. Fresh IDs and unique component references,
  explicit boundary stubs, copied internal selected wiring and attached probes.
  Paste/contact detection commits as one undoable edit; previews remain transient.
- Directional marquee: left-to-right encloses complete bounds/routes; right-to-left
  intersects bounds/segments; Shift adds. Solid blue versus dashed green outline.
See EDITOR-PROTOTYPE.md for clipboard scope and selection details.

User's next major priority is the full Falstad component set and all example
circuits, ahead of further editor polish. Added tools/inventory_legacy_catalog.py
and generated LEGACY-CATALOG.md/.json: 140 menu class references, 150 source element
subclasses (including bases/aliases), 125 resolved serialized types, 374 circuit
files, 368 menu entries, zero missing menu files. This inventories this fork only,
not upstream parity or runtime compatibility. No importer/new component models
were added in this pass. Next: legacy text import for existing models, then passive
and semiconductor model coverage, with the example dependency inventory guiding
subsequent families. Full migration sequence is in LEGACY-CATALOG.md.

Verification preference supersedes the previous next-task browser recommendation:
the user explicitly requests build-error checks only for this batch, no browser
verification, screenshots, visual checks or browser use. JS syntax checks passed.
makeEngineSite was attempted but failed before compilation on the Gradle wrapper
cache lock outside the writable sandbox. No functional suites were run this pass.
Updated frontend files copied to existing build/engine-site; this is not a fresh
engine build. Earlier uncommitted changes preserved. Nothing committed/deployed.

## Component expansion milestone — 2026-11-14

Latest direction: prioritize components; legacy circuit import can wait. The user
requested all component checks. Non-browser model/compiler/numerical/worker checks
were run; browser automation, screenshots and visual QA remain excluded.

Added 16 document/editor models, bringing the supported catalog to 23:
inductor, default diode, DC current source, potentiometer, NPN/PNP transistors,
N/P MOSFETs, N/P JFETs, two-input AND/NAND/OR/NOR/XOR gates and inverter. Each has
placement geometry, symbols, properties where applicable, validation, compiler
records, stable pin mapping and capability advertisement. Existing graph editing,
copy/paste, undo, source presets and probes use these definitions. No legacy import.

Java loader additions are explicitly validated. PotElm skips UI slider creation
when the old UI is absent; its computational position is retained. GateElm's drawing
style query tolerates absent menus. Engine initializes its private geometry grid.
CurrentElm's loader historically replaces zero current with 10 mA; the host restores
the requested zero after construction. Numerical stamping/stepping equations were
not changed. Synthetic compiler component spacing increased to avoid extra-pin
coordinate collisions. Ideal current sources without a return path are rejected.

Limits: diode is the default legacy model; transistors/FETs use the base models,
not the complete named-device library. Gates currently have two inputs and a logic
high parameter; inverter also has slew rate. Pot position 0..1 is a property edit,
not a live slider/state-preserving event. BJT/pot expose pin voltages but omit a
single ambiguous component-current value. MOS/JFET current is the legacy signed
Ids; logic output uses negative current for delivery (passive output convention).
No per-terminal current UI was added. Full 140-menu-class coverage is NOT complete.

Build/check results:
- `python3 tools/build_engine_cached.py` succeeded: Java compilation, browser engine
  GWT compilation and DOM-free worker GWT compilation, then engine-site assembly.
  This offline fallback reads existing cached GWT 2.8.2 jars without Gradle locks;
  ordinary `makeEngineSite` remains the normal build path. No network/downloads.
- All six existing Node suites passed (editor model, document adapter, coordinator,
  continuous simulation, scope model, scope sampling). The old unsupported-inductor
  assertion now checks an explicitly unknown model instead.
- `node tools/test_component_catalog.mjs` passed: analytic RL, initial states,
  current-source signs/zero, loaded potentiometer positions/endpoints, diode forward
  behavior, NPN/PNP gain, MOS/JFET polarity and cutoff, gate truth tables, reset,
  projections and all six saved numerical baselines at absolute tolerance 1e-12.
- `node tools/test_component_worker.mjs` passed for all 16 additions using a real
  Node worker thread, the production revision protocol/adapter and compiled engine:
  advertised capabilities, guarded install and worker/direct result agreement.
- Syntax and diff whitespace checks passed. No browser checks/visual QA performed.

The new Node runtime helper loads the generated worker bundle in an isolated VM
without window/document shims. This validates computation and thread isolation;
it is not a claim about browser compatibility. The legacy solver prints nonfatal
cross-matrix diagnostics during potentiometer endpoint checks; the asserted loaded
voltages/reset checks pass, but wider endpoint topology coverage remains warranted.

Next component families: transformers, switch variants, LEDs/Zeners; then sequential
logic/chips, composite/behavioral and specialized devices. LEGACY-CATALOG lists the
remaining source inventory, not a blanket compatibility claim. Full catalogue work
remains open. Work is uncommitted; prior edits preserved; no deployment.

## Transformers, multipole switches and LEDs/Zeners — 2026-11-14

Added five more models, bringing the document/editor catalog to 28:
- `transformer@1`: linear coupled windings, primary inductance, secondary/primary
  turns ratio, coupling strictly between 0 and 1, BE/trapezoidal integration.
  Pins p1/p2 are primary, s1/s2 secondary. Both winding circuits require a reference;
  magnetic coupling does not create a conductive path across the isolation barrier.
- `spdtSwitch@1`: common/a/b, A/B/center-off positions.
- `dpdtSwitch@1`: two linked poles, common1/a1/b1 and common2/a2/b2, A/B positions.
  Single-click cycles positions using existing click-vs-double-click discrimination;
  E/properties also selects position. These edits replace/reset the simulation;
  state-preserving switch support remains limited to the existing SPST RC path.
- `led@1`: forward voltage at 1 A and full-brightness current, fixed red symbol with
  current-dependent fill. Brightness current is a display threshold, not a limiter.
- `zener@1`: forward voltage at 1 A and reverse breakdown voltage.

New loader records are validated before construction. Existing TransformerElm,
Switch2Elm, DPDTSwitchElm, LEDElm and ZenerElm electrical models are unchanged.
Compiler uses actual engine post order and private geometry, including six DPDT
posts. It checks transformer coefficient finiteness, floating windings and ideal
switch loops. Transformer/DPDT omit an ambiguous single current; all public pin
voltages are mapped. No tapped/saturating transformer, variable pole count, linked
switch groups, momentary push-button or named diode-model library in this slice.

Verification completed without browser/visual checks:
- `python3 tools/build_engine_cached.py`: Java, GWT browser engine and worker build passed.
- All nine Node suites passed: six existing suites, test_component_catalog.mjs,
  test_component_expansion.mjs and test_component_worker.mjs.
- New checks include transformer analytic first-step responses for both integration
  methods, three ratios/two coupling coefficients and either driven winding;
  all SPDT positions, independent DPDT poles, LED/Zener forward/reverse behavior,
  grid rotations/flips, projection roundtrip, history/copy, invalid loader values,
  preserved prior state on rejection, floating windings and ideal-loop rejection.
- Actual Node worker checks cover all 21 added models plus driven switch, diode and
  transformer variants. Earlier six saved numerical baselines still pass at 1e-12.
- Syntax/diff checks pass. Earlier legacy pot endpoint diagnostic remains recorded
  above; this pass changed none of its equations. No browser or visual QA claim.

Source and preview assets updated; accumulated work remains uncommitted and nothing
was deployed. Next: polarized capacitors and further passive/switch variants, then
sequential logic/chips. Full Falstad catalog remains incomplete. Legacy import and
example browsing remain deferred behind component support.
