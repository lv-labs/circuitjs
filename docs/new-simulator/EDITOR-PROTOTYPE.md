# Circuit editor canvas prototype

Updated 2026-11-16. This is a browser/SVG interaction prototype using the existing
document model and worker coordinator. It is a reference harness, not the final UI
stack, and does not port the electrical simulation maths. Current priorities are
in [PLAN.md](PLAN.md); current implementation/checks are in [HANDOFF.md](HANDOFF.md).
Detailed dated continuations below preserve the development history. Where they
conflict, the current handoff and [DRAGGING.md](DRAGGING.md) take precedence.

## Build and open

```sh
node tools/test_editor_model.mjs
./gradlew makeEngineSite --console plain
python3 -m http.server 8765 --bind 127.0.0.1 --directory build/engine-site
```

Open http://localhost:8765/editor.html. Start the preview server explicitly; it is not guaranteed to be running. The editor initially opens the saved switched-RC example
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
| Move / Drag | M leaves external wires behind; G stretches connected wires; selection or hovered item, click to place |
| Add component | A opens the legacy-ordered component menu; arrows and Enter choose; click to place, Escape finishes |
| Ground / properties | P places ground; E or double-click opens component properties dialog |
| Flip | X horizontally; Y vertically; pick up, flip, reconnect at final pin positions; existing wires stay put |
| Voltage probe | Probe tool or A → Voltage probe; click a pin, wire or junction; name it in Inspector |
| Oscilloscope | Open bottom dock; Run/Pause, time/div, volts/div, channel toggles and hover cursor |
| Rotate | R counterclockwise, Shift-R reverse; same detached pick-up/put-down behavior as flipping |
| Wire | W, then click a pin/junction/wire; pin and floating-end clicks can start directly from Select |
| Add wire bends | Click empty space while wiring; finish on a connection target |
| Finish a loose wire | Double-click empty space or press Enter at the cursor; Escape cancels the draft |
| Add a branch | Finish/start on an existing wire; commits an explicit junction and split |
| Reroute | Drag a segment perpendicular to itself; dropping it onto a component pin creates an explicit contact/junction |
| Pan | Scroll, Pan tool (H), middle-drag or Space + drag |
| Zoom | Ctrl/Command scroll (including trackpad pinch), +/− controls/keys |
| Fit | 0 or Fit |
| Cancel | Escape cancels gesture/wire preview and returns to Select |
| Undo/redo | Command/Ctrl Z; Shift Command/Ctrl Z; toolbar buttons |
| Delete | Delete/Backspace; component wires survive as loose ends; voltage probes follow stubs, component current probes are removed |
| Edit values | Double-click, E or Inspector → Edit properties; SI prefixes such as 2k or 4.7u |
| Live switch | Single-click body to toggle; double-click edits without toggling |
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
retains the group. Connected component/junction dragging uses a persistent drag graph; corners slide
and temporary bends are reused as the pointer changes direction. Wire sections
merge within a net and obsolete tails are removed. Rotation/flipping leaves the
old wiring behind, and wire-on-pin drops attach atomically on commit. Directional
box selection supports contain/intersect behavior. See [DRAGGING.md](DRAGGING.md)
for the current rules and tests.

## Worker connection

The editor owns a document/history, camera, tool, selection and pointer gesture.
Only committed document edits call the existing coordinator. New/incomplete
circuits remain editable. Run is the default intent, retained through temporary
validation errors; genuine invalid models/ideal loops can suspend solving.

Layout-only commits reuse the worker and can occur during running. Supported same-document
electrical edits use guarded native `updateCircuit` and retain existing element
state/time. Explicit Reset, a different document and fault recovery create a fresh
session. Run/Pause intent is preserved; a paused edit waits for Step/Run for new
solved readings. The old revision is not rendered as live. See the latest sections
of [RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md) and [HANDOFF.md](HANDOFF.md).

Wire tint and inspector pin/current readings come from accepted stable-ID frames.
Internal solver indices never become editor identities. The source symbol uses
positive p/negative n pins and the adapter's normalized current convention.

Double-click detection uses logical component identity at pointer release, rather
than the identity of a transient SVG child. This keeps live switch interaction
reliable while frame redraws replace child elements. Pointer capture stays on the
stable root SVG during dragging; numeric inspector inputs are not rebuilt on frames.

## Code

- `packages/circuit-core/`: reusable catalog, geometry, document/history,
  commands/drag engine, compiler/protocol/coordinator and sampled signals.
- `experiments/engine/editor-model.js` and related old computational entry files:
  compatibility adapters for the existing UI globals.
- `editor.js`: pointer/keyboard handling, SVG rendering, inspector, autosave and
  integration with the shared core.
- `editor.html` / `editor.css`: prototype workspace and controls.
- `tools/check_core.mjs`: one computational regression entry point.

SVG/plain browser code makes the interaction contract concrete without adding
dependencies. A future Rust UI prototype should exercise the same cases against
the same JSON/worker boundary before any stack decision. Compare input latency,
text editing, trackpad/high-DPI behaviour, accessibility, packaging and maintenance;
do not infer those outcomes from implementation language alone.

## Initial verification history — 2026-11-13

Current focused model/browser verification is recorded in [HANDOFF.md](HANDOFF.md).
The following paragraphs describe the original prototype checkpoint.

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
wire-end reconnection, obstacle routing, touch gestures, a broader component library,
full keyboard graph navigation or CircuitJS text import. Component pointer drags
preserve attached wires, while M explicitly detaches. Inline insertion supports
clear straight spans; spans with interior branches,
component pins, probe targets or ambiguous overlapping wires are rejected. Route adjustment is
local, not obstacle avoidance or a general loop/intersection simplifier; deliberate
U-shaped routes may remain. UI layout/pin geometry is
structurally validated for the seven supported model kinds. The current renderer
rebuilds SVG children per update and has not been optimized for large scenes.

Next: dedicated wire-end reconnection and local cleanup for rejoined loose wires.
Validate those interaction rules before comparing a second frontend implementation
and committing to a toolkit. Expand
models and richer waveform/probe UI independently behind the tested boundary.


## Move/Drag and KiCad shortcut pass (2026-11-13)

M starts Move and G starts Drag on the selection, or the item under the cursor if
nothing is selected (a hovered pin picks its component). The item follows the
cursor on the grid until a click places it. R rotates counterclockwise; Shift-R
reverses it. Rotation during a pending command joins that command's undo step.
Escape, pointer cancellation or window blur discards the preview; previews do not
save, modify history or send new documents to the simulation coordinator.

Move disconnects only the selection boundary. Stationary wires keep their IDs,
routes and electrical joins through explicit loose junction endpoints at the old
pin locations. Connections internal to a moved group travel together. Explicitly
selected wires travel and detach from external pins; G on a single wire reroutes
the hovered segment, retaining its endpoints. Zero-length contacts at the boundary
collapse into the stationary neighbour, preserving other stationary branches and
removing unused newly created junctions. This is local boundary cleanup.

Drag preserves endpoint references and adjusts routes using the existing local
wire stretching. Both commands detect component pin contacts only on commit.
Move, detachment, rotation and destination contacts form one transaction, with exact
undo/redo restoration of graph, stable IDs and layout. Layout-only Drag reuses the
worker; Move changes connectivity and follows the existing replacement policy.

A opens a modal chooser for the supported models and voltage probes, searchable by name/kind or
reference prefix. Arrow keys highlight a result, Enter chooses it, Escape closes
without placing anything. The palette still offers direct placement. Old R/C/V/S/G
part shortcuts and Q rotation were removed to avoid conflicts. W is wire, E opens the properties dialog for
the selected/hovered component, P places ground, Del deletes, Ctrl/Command-Z undoes,
and Shift-Ctrl/Command-Z redoes. These cover the implemented editor actions; this
is not a full KiCad action catalog. Shortcuts leave text fields alone.

Reproducible browser input regression (isolated temporary Chrome profile):

```sh
python3 tools/verify_engine.py --editor --output /tmp/editor-results.json
```

The runner uses CDP keyboard/pointer input and the editor's normal autosave to
check hover pickup, pending rotation/cancellation, detachment, connected Drag,
exact undo/redo, chooser filtering/placement and inspector typing isolation.
Pure model tests additionally check stationary geometry, internal edges, selected
wire movement, contact branch preservation and destination-contact atomicity.


## Inline insertion (2026-11-13)

Place a two-pin component so that both pins lie on a straight wire span. On commit,
the editor removes the wire between the pins and connects the remaining two sides
to the part. This supports all four two-pin models and quarter-turn rotations,
including spans subdivided into multiple wires by ordinary two-way junctions.
The wire outside the cut may contain bends; its route and electrical endpoints are
preserved. A component moved/dropped or rotated onto a clear span uses the same
operation. Ground remains a one-pin contact and does not cut wires.

The entire edit is atomic with placement/Move/Drag/rotation and its existing undo
step. Previews do not cut the saved document. Undo restores the original wire(s),
layout, junctions and IDs; redo restores the exact insertion. Explicit connectivity
is updated before the coordinator receives the committed document, so the component
is in series rather than bypassed by the original wire.

Only the straight, collinear electrical path between the pins is removed. Unrelated
crossings remain separate. Interior two-way junctions on the removed span are
removed along with their unused layout entries; newly created cut junctions are
folded directly into the component pins to avoid redundant contacts. Existing
junctions at the cut boundaries, branches there, and probe identities are retained.
Remaining route bends are normalized by the existing local route cleaner.

An interior branch, component pin or voltage-probe target prevents insertion.
Overlapping/parallel candidates are rejected as ambiguous. The UI explains the
rejection and keeps the document, autosave and undo stack unchanged. This does not
remove alternate bypass paths elsewhere in a circuit, route around obstacles,
or reconnect arbitrary loose wire ends. Import and rendering never auto-insert.

Verification adds model checks for all two-pin kinds/rotations, multi-wire spans,
boundary branches, protected interior branches/probes, overlapping candidates,
unrelated crossings, short/off-axis spans, Move insertion and exact undo/redo.
The browser suite places a 1 kΩ resistor through A and real pointer input into a
5 V divider's source lead: a real worker reports 5/3 V output and 5/3000 A through
the inserted part, then undo/redo restores the exact documents. A separate pointer
check verifies branch rejection produces a notice without any saved/history edit.


## Op-amps, flips, probes and properties (2026-11-13)

A → Op-amp places a three-pin amplifier with stable `minus`, `plus`, `out` pin IDs.
This uses CircuitJS's existing OpAmpElm equations. The defaults are open-loop gain
100000 and −15/+15 V output limits. Supplies are implicit; separate supply pins,
bandwidth/slew-rate controls and specific manufacturer models are not included.
Properties exposes gain and both output limits. Op-amp current readings use positive
current delivered from the output to the external circuit. A runnable gain-two
example is included in `examples/opamp-noninverting.json` in the built site.

X flips left/right and Y flips top/bottom in world axes, matching the KiCad shortcut
names. Toolbar buttons expose both actions. Flips work on selection/hover, placement
previews and pending Move/Drag; order with R is preserved. Committed flips preserve
pin identities and electrical connectivity, stretching attached routes. A flip alone
does not add new geometric contacts. Placement and a Move/Drag drop still detect
contacts when committed. Each flip is one undo step, or joins the pending gesture.

Use the Probe tool or choose Voltage probe from A, then click a pin, wire or junction.
A wire-interior placement creates an explicit junction/split in the same undo step.
The saved voltage marker has `reference: "ground"`, a stable ID, target reference and
label; `layout.probes[id]` stores the label's offset from the target. It adds no
solver component and does not change canonical electrical identity. Its displayed
voltage comes from the latest accepted stable-ID frame, with no stale value during
replacement/errors. A disconnected target displays a dash. Drag or M/G repositions
the label; Delete removes it. Undo/redo and JSON Save/Open preserve the marker.
Existing differential voltage probes remain valid; only probes with explicit label
layout are drawn. Removing a component/junction also removes probes targeting it.
Deleting a probe currently leaves the electrically equivalent routing split.

Double-click any component, press E, or use Inspector → Edit properties to open the
modal editor. Reference and model parameters are edited together. Apply validates
and commits them in one undo step; invalid entries remain in the dialog with an
error; Cancel/Escape discard the draft. Resistors/sources/capacitors accept SI
numbers, capacitors also expose initial voltage/integration, switches expose their
closed state, and op-amps expose gain/limits. Ground has a reference field only.
Simulation frame updates do not overwrite fields while typing.

Single-click a switch body toggles it. The action waits 450 ms to distinguish a
double-click, which opens properties without first sending a toggle to the worker.
Dragging a switch does not toggle it. Existing live-switch policy remains unchanged;
state-preserving live changes are verified for the RC cases, not general op-amp
switching. Cancel/tool/document changes cancel pending body-click actions.

New numerical checks cover finite-gain non-inverting/inverting amplifiers, a follower,
positive/negative saturation, output-current sign, worker/main agreement, reset and
invalid input preservation. Editor browser checks cover placement/flipping, the
live 2 V probe, property validation/application/cancellation/undo, and switch click
separation. The worker had a rendering-only font/CSS lookup in OpAmpElm.setPoints;
that lookup and mouse-creation access are guarded when no old UI exists. Numerical
stamping/stepping equations are unchanged.


## Sine sources and loose wires (2026-11-13)

A → AC source (2 terminals), also in the palette, places a voltage source with a
sine waveform by default. The one-terminal AC and DC variants are available too.
It uses the existing `voltageSource@1` device with waveform
`{kind: "sine", amplitude, frequency, offset}`. Defaults are 1 V peak, 1 kHz and 0 V
DC offset. Double-click/E exposes all three fields, accepting SI prefixes such as
500m and 2k. Amplitude is peak, not peak-to-peak or RMS; frequency must be positive,
amplitude nonnegative and all values finite. Offset may be negative. DC sources
keep their existing saved shape; their voltage field appears when DC is selected. Sine properties apply
as one undoable electrical edit using the existing replacement/reset policy.

The properties dialog now focuses and selects the whole first value field when
opened, so typing immediately replaces it. This applies to all components through
double-click, E and the Inspector button. Components without a value field select
the reference instead. Frame updates leave the selection/draft alone.

While wiring, a single click in empty space adds a bend. Double-click empty space
or press Enter to finish at a grid-snapped loose endpoint. Finishing creates one
explicit junction and wire in the same transaction as any split of the start wire.
A small hollow square marks a degree-one junction. An unfinished draft is never
saved; Escape cancels it. Zero-length drafts create no document/history entries.
The loose endpoint survives Save/Open and local reload, and can start another wire
by clicking it in Wire mode. Reconnection uses the existing explicit junction
rather than connecting arbitrary overlaps. General endpoint-grab/rerouting cleanup
remains separate work.

`examples/opamp-sine.json` is a gain-two op-amp driven by a 0.5 V peak, 1 kHz source
with 0.25 V offset and an output probe. Numerical tests exercise the source formula,
positive/negative offsets, zero amplitude, frequency changes, op-amp gain/clipping,
reset and main/worker agreement. Legacy voltage sources evaluate at the start of
the last completed timestep, so comparisons use frame.time minus frame.timeStep.
No Java model/solver changes were required for this slice.


## AC source names, waveforms and one-terminal rails (2026-11-13)

The palette and A chooser now distinguish four presets: DC source (2 terminals),
AC source (2 terminals), DC source (1 terminal), AC source (1 terminal). Searching
`ac-source` finds the AC variants. Existing saved sine sources keep the same schema
and appear as AC sources. The former sineSource placement API is retained as an
alias for acSource, but it is not a visible chooser entry.

Properties for either source model include Waveform: DC, Sine, Square, Triangle,
Sawtooth or Pulse. AC fields are peak amplitude, positive frequency and DC offset.
Square and pulse additionally expose duty cycle as a percentage, strictly between
0 and 100; the saved value is a fraction. Pulse swings from offset to offset plus
amplitude; square/sine/triangle/sawtooth swing about the offset. Changing waveform
retains common draft field text and the duty value when switching away/back.
Reference edits stay intact. Apply commits the selected waveform and active fields
in one undo action; Cancel/Escape discard all changes. Opening/changing the waveform
still selects the main numeric field for immediate typing.

One-terminal sources use `voltageRail@1`, with one public `p` pin and the same
waveform parameters. Their reference is implicit ground, using CircuitJS RailElm.
A ground symbol is not required solely to define the source reference. External
return paths must still be explicit where needed. Ideal rail/source shorts/loops
are rejected before load rather than triggering legacy resistance repair. Current
is reported positive into the rail pin, matching the two-terminal passive source
convention. Placement is anchored at the connection pin at every rotation/flip.
A one-pin source creates contacts rather than cutting a wire as an inline part.

`examples/opamp-ac-rail.json` demonstrates a one-terminal AC source driving the
non-inverting amplifier, with an output probe. Existing waveforms use the unchanged
VoltageElm/RailElm maths; EngineEntryPoint only adds validated waveform/rail record
loading, including the explicit pulse duty flag. No solver/model equations changed.

Tests cover all six waveform choices on both terminal counts, non-default duty,
analytic sample values, op-amp gain, reset/main-worker agreement, and currents
between two rails with no explicit ground symbol. Editor checks cover all four
chooser presets, modal waveform/duty drafts, percent conversion, invalid duty,
cancel/undo, and a real rail-driven op-amp/probe update after changing waveform.


## Multi-probe oscilloscope (2026-11-13)

Place voltage probes on the op-amp input and output. Select a marker and use Probe
name in the Inspector to name it Vin/Vout. Open the Oscilloscope dock at the bottom
and click Run (either toolbar). All connected voltage probes plot together against
simulation time, with shared time/voltage axes. Marker, legend and trace colors
match by stable probe ID. Existing saved differential voltage probes are plotted
as positive minus negative; current probes are not scope channels in this slice.

Use Time per division to set the ten-division rolling window. Voltage Auto fits
all visible signals to a shared zero-centered scale; manual V/div keeps the scale
fixed. Toggle channels in the legend without losing their stored data. Pause
freezes acquisition after the in-flight batch; hover the plot for synchronized
sample readings, with a difference readout when exactly two channels are visible.
The legend reports latest/min/max values for the current visible time window.
Clear erases captured samples without editing the circuit or stopping Run. Step
acquires each successful electrical step too. Collapsing/reopening retains capture.

Samples come from every simulation step inside a worker request, not from browser
paint frames. One batch carries the requested stable pin pairs and aligned voltage
arrays back to the coordinator. The editor resolves explicit probe graph references
to deterministic terminal IDs; it never infers contacts or uses private solver
indices. Sample times follow the existing source convention (completed frame time
minus timestep). Voltage/time values are actual solver samples, not synthesized
from source settings. Dense display traces keep per-pixel first/last/min/max points
rather than averaging away peaks.

The buffer is bounded to 20,000 samples per channel and the first 32 resolved
voltage probes. Unresolved/excess probes are reported in scope info. Time range is
limited by the retained buffer and electrical timestep. Captured history/settings
are session-only and excluded from JSON/autosave; saved probe names/targets/layout
remain normal undoable document edits. Adding/removing/retargeting a channel begins
a new aligned capture. Renaming or moving a label preserves capture. Reset, worker
replacement or invalid simulation clears old traces; a supported live RC switch
can continue history in the same run epoch after the revision acknowledgement.
Old session/revision/sequence/channel batches cannot become current traces.

`examples/opamp-oscilloscope.json` contains a one-terminal 1 kHz AC input, gain-two
amplifier and named input/output markers. The dock starts collapsed to leave canvas
space. This is a rolling voltage viewer, without triggering, single-shot capture,
independent per-channel axes, current traces, persistence or CSV export yet.

Code: scope-model.js owns the ring buffer, identity/target guards and peak envelope;
scope-view.js owns the dock, controls, cursor and SVG rendering. New pure checks
are tools/test_scope_model.mjs and tools/test_scope_sampling.mjs. Real-worker scope
checks join the engine verifier; the editor input suite exercises capture, controls,
renaming, deletion/undo, reset, source edits and label/layout retention.

## Endpoint reconnection, visible grid and scope panes (2026-11-14)

In Select mode, drag a hollow loose-end square onto a pin, junction or wire to
reconnect it. The highlight previews the snap target. Release commits one undoable
change; Escape cancels. Dropping in blank space moves the loose endpoint. Endpoint
pickup applies to a single selected loose junction; group dragging keeps its
existing behavior. Wire mode still extends a wire from the loose junction.
Cleanup removes the redundant source junction and local route bends while retaining
wire IDs, target branches and probe identities. Wire crossings elsewhere do not
connect. Degree-two destination junctions remain explicit; this is local cleanup.

The canvas Grid selector offers Lines (default), Dots and Off. Grid geometry follows
pan/zoom and the 16-unit placement grid; hiding it does not disable snapping.

Oscilloscope + Pane adds up to four views of the same synchronized capture. Each
pane has its own probe checkboxes and voltage scale; the main voltage control is
labeled Pane 1 voltage. Time/div and hover cursor are linked. Choose Stacked or
Side by side (wraps when narrow); drag a pane's bottom-right resize handle to change
its height. Remove deletes a view without clearing captured samples. Clear resets
capture for all views. Pane layout, channel visibility, scales and grid choice are
session-only. No independent time scales or saved pane layout in this iteration.

Pure model checks pass. New browser regressions are present but pending execution
because the current sandbox blocks local server sockets; visual QA is pending too.

## Copy/paste and directional selection (2026-11-14)

Ctrl/Command-C copies the selection (or hovered item when nothing is selected),
Ctrl/Command-V starts a cursor-following paste, and Ctrl/Command-D duplicates.
Toolbar buttons expose the same commands. Click to place; R/X/Y use the existing
pending-transform behavior; Escape, blur or pointer cancellation discard the draft.
The clipboard is in-memory within this editor tab, not the OS clipboard, and is
lost on reload. It can be pasted after opening a different JSON in the same tab.

Copies include selected components/junctions/wires, wires with both endpoints
selected, and probes whose targets are included. Select intermediary wires and
junctions too when copying a connected section. External endpoints of explicitly
selected wires become shared loose stubs. Unselected external components are not
referenced by the pasted graph. Standalone probes need their targets selected.
Paste allocates new stable IDs, remaps all references and assigns unique component
reference labels. Placement/contact detection is one history transaction. Preview
never updates autosave or the simulation. Component parameters and initial values
copy; simulation state and transient scope capture do not.

Box left-to-right selects fully enclosed component bounds, routes and probe labels;
right-to-left selects intersected bounds or route segments, including segments with
both endpoints outside the box. Junctions use point containment. Shift adds to the
selection. Enclosure uses a solid blue outline; crossing uses dashed green.

Verification for this pass is limited to syntax/build checks per user direction;
no functional test suites, browser use, screenshots or visual checks were run.

## Expanded component catalog (2026-11-14)

A/chooser and the palette now include inductor, diode, current source, potentiometer,
NPN/PNP, N/P MOSFETs and JFETs, AND/NAND/OR/NOR/XOR gates, and inverter (23 models total).
Inductors expose initial current/integration; current sources expose current and
compliance (0 = ideal); pots expose total resistance and position 0..1; transistors
expose beta; FETs expose model threshold and beta; gates expose logic high; inverters
also expose slew rate. The diode uses the default legacy diode parameters.

These are base models, not all Falstad variants/options. Gates currently have two
inputs. Pot changes use normal replacement/reset, not a live slider. BJT/pot do not
report an ambiguous single component current. No browser visual verification has
been performed for these additions, per user preference; numerical and Node worker
checks pass. Full catalog coverage remains in progress; legacy import is deferred.

## Transformer, multipole switches and light-emitting/Zener diodes (2026-11-14)

Five additional models are available through A and the palette (28 total).
Transformer exposes primary inductance, secondary/primary turns ratio, coupling
and integration; its isolated winding circuits each need a reference. SPDT cycles
A → B → Off; DPDT cycles both poles together A ↔ B. Single-click or use the Position
property; double-click still edits without toggling. These multipole switch edits
reset simulation rather than preserving live state.

LED and Zener expose their legacy model's forward voltage at **1 A**. LED also
exposes full-brightness current and uses a red current-dependent symbol fill;
this does not limit current. Zener exposes reverse breakdown voltage. Transformer
and DPDT show pin voltages but no single aggregate current. Winding saturation,
tapped transformers, named diode models and configurable pole counts are not yet
implemented. Build/numerical/worker checks pass; no browser/visual checks were run.

## Passive/controlled-switch additions — 2026-11-16

The searchable A chooser includes Polarized capacitor, Analog switch (SPST) and
Analog switch (SPDT). Polarized capacitors mark the positive plate with +; control
leads on analog switch symbols are marked C. E/double-click properties expose the
capacitance, initial voltage, integration and reverse-voltage limit, or switch
on/off resistance, threshold, inversion and pulldown settings. These devices use
normal explicit pin contacts, rotation/flips, graph editing, copying and history.
Analog switches respond to their control pin rather than click-to-toggle. Editing
parameters follows the usual replacement/reset policy.

## Display/logic I/O additions — 2026-11-16

The A chooser and palette now include Output marker, Logic output and Logic input
(34 models total). Output markers render a small "out" box and show the solved
voltage beside the reference when Show voltage is enabled; this display-only marker
does not modify the circuit. Logic outputs render an "L/H" box and show the live
legacy level (L/H, 0/1, or 0/1/2) plus voltage; their optional 1 MΩ pulldown is a
property checkbox. Logic inputs render a state circle, show their high/low options,
and cycle state on single click (Off/0, 1, and 2 only in ternary mode). Double-click
still opens properties without toggling.

Properties expose show-voltage; threshold, mode and pulldown; or state, high/low
voltage and mode. Validation rejects non-finite levels, invalid modes, states above
1 outside ternary mode, and a ternary state without ternary mode. These devices use
normal explicit pin contacts, rotation/flips, graph editing, copying and history.
Parameter edits replace/reset the simulation. Limits: no OutputElm scale or
fixed-precision setting, no momentary logic-input button, and no per-terminal
current UI. No browser/visual checks were run for this batch.

## Flip-flop additions — 2026-11-16

The A chooser and palette now include D, JK and T flip-flops (37 models total).
Chip symbols label D/T/J/clock/K/Q/Q̄, and each shows live Q as `H/L · voltage`
plus logic-voltage/initial-state value text. Properties expose High voltage,
`Q starts high`, and (JK) `Positive-edge clock`. D/T/JK use the legacy base
variants only: no set/reset pins or small-chip option. Clock-edge behavior is
the legacy chip model, so tests use static clock rails and see one rising edge
per load (the D flip-flop defers its first execute after load, while the T
flip-flop toggles on it). Inputs must be externally referenced. These devices
use normal explicit pin contacts, rotation/flips, graph editing, copying and
history; parameter edits replace/reset the simulation. No per-terminal current
is shown. No browser/visual checks were run for this batch.

## Falstad Add popup and next chip batch — 2026-11-16 (latest)

A or Add… opens the component popup at the last canvas pointer location (clamped
inside the viewport). Its top-level entries, submenu labels, component names and
ordering come from this fork's `Menus.composeMainMenu`, generated by
`python3 tools/generate_component_menu.py` into `legacy-component-menu.js`.
The flat search chooser is replaced. Categories open by pointer hover/click or
Right/Enter; Up/Down and Home/End move through a panel, Left returns to the parent,
and Escape or an outside click closes it. Long panels scroll; narrow windows can
scroll between panels. Components not implemented yet remain visible with
`aria-disabled` and an availability explanation; they cannot select a tool.
Subcircuits retains its original position with an empty-state message: no dynamic
legacy subcircuit library is imported. Legacy Drag actions without corresponding
new-editor commands are disabled. Wire and Select/Drag Sel use the existing tools.

Square Wave Source and Clock select existing one-terminal square-wave source
presets. Clock defaults to 0–5 V at 100 Hz, matching the bundled legacy constructor.
The alternate ideal op-amp entry places the same model flipped vertically so + is
on top. Legacy Voltmeter/Scope Probe is still unavailable: the current non-loading
voltage marker tool remains on the toolbar and is not substituted for that model.

Four additional chips are available in Digital Chips: four-bit Counter, four-bit
Latch/Register, Half Adder and four-bit Adder. E/double-click exposes logic voltage,
plus state/reset/edge/modulus options where supported; bit widths are fixed in this
schema slice. Chip bodies and pin labels scale to their geometry. Hit testing now
covers the entire tall chip body, including the previously missed JK body ends.
Existing flips/rotation/copy/history and explicit connectivity are retained.

## Passive-menu continuation — 2026-11-16

Push Switch, Make-Before-Break Switch, Tapped Transformer, Custom Transformer and
Transmission Line are enabled in their original Passive Components positions.
Push symbols operate while held with Select; releasing, Escape, losing focus or
changing tools restores their rest contact. Shift-click selects without operating;
M/G can move the selected/hovered symbol. E/Inspector or double-click opens its
normally-open/closed property. A transient document overlay keeps press gestures
out of history and saved circuit state. Simulation resets on contact changes;
state-preserving momentary operation is not implemented.

MBB single clicks cycle A → A+B → B → A+B. The four-position property can also be
edited. Transformer properties expose inductance, ratio/turns, coupling and
integration. Custom Transformer currently has three fixed windings; its signed
turns fields select polarity, not a free topology string. Transmission Line exposes
delay/impedance and needs both return pins grounded. See DOCUMENT-ADAPTER for the
bounds and electrical limits. Geometry, contacts, transforms, copy and history use
the existing stable graph. New pointer interaction is not browser-verified under
the recorded no-browser preference.

## Variable Voltage and Outputs/Labels — 2026-11-16

This batch integrated Variable Voltage and all 20 Outputs and Labels menu entries.
See [PLAN.md](PLAN.md) for current menu coverage.
The variable source Inspector slider uses state-preserving worker updates; annotation
edits preserve electrical identity. New meters, displays, LED array, recorders,
trigger and motors reuse original Java models. Optional AC phase permits balanced
three-phase excitation. Inspector includes measurements, probe plotting, CSV and
audio playback/WAV; stop triggers pause continuous runs. Display widths and array
size are fixed in this slice; broader variants and legacy import remain deferred.
See the latest HANDOFF section for parameter/measurement/capture limits and checks.
No browser or visual verification under the recorded user preference.

## Continuous editing and default Run — 2026-11-16 (latest)

Simulation now runs by default (`autoRun: false` is available for manual stepping).
Run/Pause survives layout/electrical edits and reset; Pause during installation wins.
Invalid intermediate documents retain the selected intent and resume when repaired.
Floating parts no longer block simulation: the original solver supplies its existing
100 MΩ reference stabilization. Open current sources use its high-resistance fallback.
Warnings replace the previous floating/return-path rejections. Ideal-loop validation
and genuine solver-fault stops remain. Topology changes rebuild/reset then resume;
pure layout changes and live variable-voltage/contact edits preserve solver state.
Live contacts cover SPST, push, SPDT, DPDT, MBB and logic-input state changes, with
FIFO revision/epoch guards. See latest HANDOFF for verification and remaining limits.

## Variable-voltage drag continuity — 2026-11-16 (latest)

Dragging now coalesces pending source values and requests a prompt physics batch
between updates. Last sampled readings remain visible within the same solver epoch,
avoiding blank/flashing circuit readings on each live revision. Release retains
range focus and creates one history entry; returning to the starting value still
restores the physical source. Escape/pointer cancellation reverts; ordinary focus
loss/tool changes retain the selected value. Native VarRail model, time, charge and
Run/Pause are preserved. See latest HANDOFF and `tools/test_voltage_slider.mjs`.

## Scope continuity across edits — 2026-11-16 (latest)

The oscilloscope retains history through component placement/moves and transient
invalid edits. Solver rebuilds append a new segment to the continuous acquisition
time axis; native engine time and recorded/exported sample times remain unchanged.
Explicit Reset or changing document still starts a fresh acquisition. This preserves
scope history without claiming physical state migration across topology rebuilds.
See latest HANDOFF and `tools/test_scope_continuity.mjs` for checks and details.

## Native in-place circuit edits — 2026-11-16 (latest)

Ordinary same-document electrical edits now update the existing worker and retained
legacy element instances through guarded `updateCircuit`, followed by original
Falstad reanalysis. Value edits, component additions/removals and named-net rewiring
retain simulation time and existing dynamic state. Timestep edits are also in place.
Editable configuration is copied explicitly; constructor defaults do not overwrite
live state. Run/Pause and FIFO revision/epoch gates remain. Explicit Reset, a different
document or actual fault recovery still creates a new session. Native buffer-changing
options may reset their own buffer as in the original; unrelated models are retained.
This supersedes earlier topology-edit reset limitations. See latest HANDOFF and
`tools/test_live_reanalysis.mjs` for contracts, checks and remaining validation limits.

## Wire editing quality of life — 2026-11-16 (latest)

Deleting a component preserves attached wires as loose ends at its former pins.
Wires explicitly selected for deletion are removed. Connected collinear pieces
merge into a straight section regardless of creation history; corners, components,
branch junctions and probe anchors bound independently selectable sections. Existing
bent paths are normalized when opened in the editor. Crossing wires remain separate
unless explicitly connected. Changes and normalization share one undo transaction;
electrical connectivity is preserved by normalization. See latest HANDOFF and
`tools/test_wire_sections.mjs` for checks and model integration details.
