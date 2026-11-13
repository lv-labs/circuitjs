# Circuit editor canvas prototype

Implemented, 2026-11-13. This is a browser/SVG interaction prototype using the
existing document model and worker coordinator. It does not choose the final UI
stack or port the electrical simulation maths.

## Build and open

```sh
node tools/test_editor_model.mjs
./gradlew makeEngineSite --console plain
python3 -m http.server 8765 --bind 127.0.0.1 --directory build/engine-site
```

Open http://localhost:8765/editor.html. The current session's preview server is
already running there. The editor initially opens the saved switched-RC example
with a readable layout. Later loads restore this prototype's local autosave.

Use Save to download the circuit document as JSON for another machine. Open reads
that same format. Local autosave belongs to the browser/origin and is not transferred
by Git. Source, instructions and test fixtures still need committing/pushing before
switching development machines. The JSON is the existing schemaVersion 1 format,
including stable IDs, layout, explicit connections and initial conditions.

## Interactions

| Action | Input |
| --- | --- |
| Select/drag | Select tool (1); click or drag a component body; attached wires stretch |
| Multiple selection | Shift-click; drag an empty-area box; Shift-box adds |
| Move a group | Drag a selected component; connections follow pins |
| Place parts | R resistor, C capacitor, V DC source, S switch, G ground; click repeatedly |
| Rotate | Q, Shift-Q for reverse; works on selection or placement preview |
| Wire | W, then click a pin/junction/wire; pin clicks can start directly from Select |
| Add wire bends | Click empty space while wiring; finish on another connection target |
| Add a branch | Finish/start on an existing wire; commits an explicit junction and split |
| Reroute | Select and drag a wire segment perpendicular to itself |
| Pan | Scroll, Pan tool (H), middle-drag or Space + drag |
| Zoom | Ctrl/Command scroll (including trackpad pinch), +/− controls/keys |
| Fit | 0 or Fit |
| Cancel | Escape cancels gesture/wire preview and returns to Select |
| Undo/redo | Command/Ctrl Z; Shift Command/Ctrl Z; toolbar buttons |
| Delete | Delete/Backspace; attached wires/probes are removed with a component |
| Edit values | Select a component and use Inspector; SI prefixes such as 2k or 4.7u |
| Live switch | Double-click the body or use its inspector button |
| Simulate | Run/Pause, Step, Reset |
| Files | Save/Open buttons or Command/Ctrl S/O; New creates an undoable empty document |

The interaction direction is KiCad-like. All supported component pins lie on the
16-unit grid at every quarter-turn rotation. Ground placement is anchored at its
connection pin, so clicking a resistor endpoint places a connected ground directly
against it. Other parts use their body anchor. Opening an older document/autosave
snaps poses, junctions and bends to the grid without changing its electrical graph.

Placing, rotating or dropping a component with a pin exactly on another pin or
junction creates an explicit contact edge. A pin dropped onto an unconnected wire
interior splits it at a junction and attaches there. These changes share the same
undo transaction as the placement/drop. Already connected endpoints do not acquire
duplicate edges. A coincident contact edge has no visible length; dragging its
component away reveals a wire while preserving the connection and stable IDs.

Crossing wires do not connect merely by overlap. Loading/rendering a document
never infers new connections from geometry: contact detection is an editor command
that writes explicit graph edges. Manual wire completion remains available.
Starting a wire, moving the pointer and adding draft bends do not mutate the
document. Escape discards the preview. A drag previews locally and commits once
on pointer release; contact detection runs on commit rather than during preview.

Pin terminals and ordinary two-way joins have no visible circles. Filled dots mark
actual connected branches with at least three incident leads/wire legs. An explicit
junction gets a selection outline when selected, even if it needs no branch dot.

Clicking a selected member without dragging collapses a multiple selection; dragging
retains the group. Component and junction moves preserve endpoint references.
Attached routes adjust their adjacent legs when endpoints move; collinear bends,
including out-and-back spurs, are removed. Wire segment dragging changes route
bends while retaining both connections. The
first box-selection implementation selects component centers, contained wires and
junctions; directional contain/intersect semantics are not implemented yet.

## Worker connection

The editor owns a document/history, camera, tool, selection and pointer gesture.
Only committed document edits call the existing coordinator. New/incomplete
circuits are valid editable documents even while they cannot simulate; their
worker diagnostic becomes an editing hint and Run remains unavailable.

Layout-only commits reuse the worker and can occur during running. A completed
electrical change uses the established replacement or live-switch policy.
Successful replacement gets one explicit preview step while paused; layout-only
changes do not advance simulation. A paused live-switch edit waits for Step/Run
before displaying new solved readings. The old revision is not rendered as live.

Wire tint and inspector pin/current readings come from accepted stable-ID frames.
Internal solver indices never become editor identities. The source symbol uses
positive p/negative n pins and the adapter's normalized current convention.

Double-click detection uses logical component identity at pointer release, rather
than the identity of a transient SVG child. This keeps live switch interaction
reliable while frame redraws replace child elements. Pointer capture stays on the
stable root SVG during dragging; numeric inspector inputs are not rebuilt on frames.

## Code

- `experiments/engine/editor-model.js`: model catalog/pin geometry, structural
  validation, document transactions/history, route geometry, hit testing, explicit
  branching, connected movement/deletion, anchored zoom.
- `editor.js`: pointer/keyboard interactions, SVG rendering, inspector, autosave,
  JSON files and the existing coordinator integration.
- `editor.html` / `editor.css`: desktop workspace, component palette, controls and inspector.
- `tools/test_editor_model.mjs`: pure graph/history/geometry checks.

SVG/plain browser code makes the interaction contract concrete without adding
dependencies. A future Rust UI prototype should exercise the same cases against
the same JSON/worker boundary before any stack decision. Compare input latency,
text editing, trackpad/high-DPI behaviour, accessibility, packaging and maintenance;
do not infer those outcomes from implementation language alone.

## Verification

Pure checks cover stable IDs, one-action transactions, undo/redo, connected group
movement without electrical changes, rotated pin geometry, route-only edits,
explicit/atomic junction splitting (including twice on one wire), deletion cleanup,
pin-contact placement, all model pins at all four grid-aligned rotations,
ground-at-cursor placement, contact-to-visible-wire dragging with unchanged
canonical electrical identity, atomic undo, dropped-pin wire splitting, true branch
dots, stale-bend backtracking removal, invalid imports and pointer-anchored zoom.

Browser checks through real pointer/keyboard input verified placement, click/Shift/
box selection, group dragging/undo, pin-to-pin wiring with bends, wire-interior
branching, rerouting/undo, pan/zoom controls, SI value entry and simulation feedback.
The test branch added a 1 kΩ resistor across 5 V and reported 5 mA; its completion
created exactly one junction and was undone in one action. The example was restored.
Dragging while running retained Running status, and a switch double-click while
running showed Open and the coordinator's preserved-state acknowledgement.

Latest visual check confirmed invisible pin terminals, branch dots, and ground
placement directly onto a resistor pin (8 parts, still 7 visible wires). Temporary
test placements were undone, preserving the user's six-part autosave. The browser
automation drag operation failed before dispatching input, so this session's new
ground-drag behaviour is covered by the pure route/graph regression rather than a
successful browser drag. Earlier editor pointer checks above remain historical.
The final screenshot is generated at `build/editor-preview.jpg`.

The existing Node adapter/coordinator/live-run checks and combined Chrome simulation
regressions remain the numerical boundary tests. There is no large-circuit UI
performance claim from this six-component interaction prototype.

## Limits and next work

Desktop pointer/keyboard prototype: no copy/paste, box-direction variants, dedicated
wire-end reconnection, obstacle routing, touch gestures, component library search,
full keyboard graph navigation or CircuitJS text import. All component pointer
drags currently preserve attached wires; a separate detach/move command is not
implemented. Dropping a two-pin device across a wire does not cut out the intervening
wire segment (inline component insertion is not implemented). Route adjustment is
local, not obstacle avoidance or a general loop/intersection simplifier; deliberate
U-shaped routes may remain. UI layout/pin geometry is
structurally validated for the five supported model kinds. The current renderer
rebuilds SVG children per update and has not been optimized for large scenes.

Next: distinguish wire-preserving Drag from a separate Move command with explicit
disconnection semantics, then implement inline component insertion/wire cleanup.
Validate those interaction rules before comparing a second frontend implementation
and committing to a toolkit. Expand
models and richer waveform/probe UI independently behind the tested boundary.
