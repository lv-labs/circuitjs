> Historical checkpoints, archived 2026-11-16. Read [HANDOFF.md](HANDOFF.md) for current status and direction. Older next-task and verification restrictions below applied to their original batches.

# New simulator: handoff

## Preserve wires on delete; select geometric wire sections — 2026-11-16 (latest)

User requests: deleting a component must leave its attached wires, and connected
wire pieces must forget creation boundaries while each straight horizontal/vertical
section selects independently up to a corner, component or actual junction.

Component removal now replaces surviving pin endpoints with loose junctions at the
old pin coordinates, sharing one stub per removed pin. It preserves existing wire
IDs/routes and shared branches, and does not bridge the gap between different pins.
Explicitly selected wires are still deleted. Voltage probes at removed pins follow
the new loose endpoint; a current probe on a removed component is removed. Undo/redo
restores exact graph/layout/probe snapshots.

Added `normalizeWires` and editor-enabled `M.create(...,{wireSections:true})` (third
argument). The editor runs normalization on initial load and inside every committed
transaction, including opening/reconnecting/moving existing circuits. The base model
keeps legacy bent-edge support by default for other computational callers. Normalized
saved editor graphs have one wire edge per straight section. Bend vertices become
two-way nodes; collinear degree-two nodes merge regardless of which gesture created
them. Corners, branch junctions, component contacts and voltage-probe anchors remain
boundaries. Duplicate explicit edges/zero-length junction contacts are cleaned up.
A rerouted straight section retains its original ID on the middle moved section.

The existing wire hit/select/highlight/delete/move/copy machinery therefore operates
on geometric sections instead of old multi-bend creation gestures. Merely crossing
or sharing coordinates never joins independent nets: normalization rewrites only
explicit connections. Actual drawing/reconnection still uses the established graph
resolver to connect to a wire interior or endpoint. Pure normalization preserves the
adapter's canonical electrical projection and therefore cannot reset the solver.

Verification: all 23 non-browser suites pass (previous 22 plus
`node tools/test_wire_sections.mjs`). New checks cover collinear multi-gesture merge,
single-gesture L sections, independent corner/branch hit targets, nonjoining crossings,
loose-end reconnect/merge, reroute/section deletion, component deletion preserving
wire geometry/shared ends/probes and its unbridged gap, replacement component contacts,
idempotence, exact undo/redo and electrical equivalence across example/output/passive/
transformer families. Updated the old component-delete assertion to expect preserved
wires. JS syntax and `git diff --check` pass. Built frontend refreshed; no Java changes.
No browser/visual verification under recorded preference; no deployment or commit.

## Native in-place circuit edits — 2026-11-16 (latest)

User clarified the desired behavior is original Falstad-style continuous editing,
including resistor/property changes and connecting/disconnecting named nodes.
Earlier Run-intent preservation and scope-history stitching were insufficient:
ordinary electrical edits still replaced the worker and reset all dynamic state.
This section supersedes those architectural limits below.

Implemented a general guarded `updateCircuit` path. The adapter reconciles stable
component IDs/kinds to old/new legacy element indices, including index shifts when
parts are inserted/deleted. The Java host validates the entire fresh parse and the
unique/type-compatible retention map before mutation. It retains the actual
existing CircuitElm instances, updates editable configuration and synthetic post
geometry, rebuilds wires and calls original `analyzeCircuit` / `preStampAndStampCircuit`.
It does not call resetTime or reload retained models. Simulation time, capacitor
voltage, inductor currents, motor momentum, logic state/clock edges, meter averages,
transmission buffers and recorder histories survive unrelated edits. Fresh/changed
model kinds receive new instances; removed parts are dropped. Named-node aliases
are recompiled and private label names updated when synthetic indices move.

`EngineCircuitUpdate.java` explicitly copies supported editable configuration fields
without copying constructor-initialized runtime state. It reuses legacy setup hooks
for changed inductors/motors/diodes/transformers/lookup tables. AC frequency changes
retain the phase origin using the original frequency-edit formula. Initial-value
properties remain values for the next Reset, preserving current stored state.
Native local resets still apply to options that inherently replace their own buffers
(e.g. changing transmission delay or recorder capacity/rate); unrelated devices do
not reset. Timestep changes also reanalyse in place and retain clock/dynamic state;
transmission buffers are resized for the changed timestep. Newly added audio output
starts capturing at current simulation time.

Worker capability negotiation advertises `updateCircuit`. The coordinator uses the
same revision-guarded FIFO as voltage/contact changes for all other same-document
electrical edits, retaining session and run epoch. It drains in-flight batches before
mutation and prompts the next solve while respecting Pause. Compilation errors
remain nonmutating, and repairing an invalid intermediate edit can update the still
healthy retained solver. Explicit Reset, a different document, or recovery from an
actual fault still installs a fresh worker. Old/fake clients without this capability
retain the previous replacement fallback. Raw/document worker APIs expose updates
as well. Scope on the normal native-edit path now receives continuous raw engine
time; its previous segment-offset mechanism remains only for actual replacements.
Existing document parameter/ideal-loop validation is retained; no claim that every
legacy UI option, unsupported model, or invalid circuit is accepted.

Verification: fresh cached Java 8/GWT engine, worker and site build; all 22 non-browser
suites pass (previous 21 plus `node tools/test_live_reanalysis.mjs`). New tests compare
retained output/passive/transformer/switch/logic/chip model families against continuous
control engines after an unrelated placement/index shift, including motor metrics
and capture buffers. Analytic RC/RL tests cover resistor/capacitance/inductance and
timestep edits, named-net disconnection/reconnection without discharging the cap,
nonmutating invalid edits, FIFO general edits on one worker/epoch, and explicit Reset.
Real dedicated Node worker cases now apply a general circuit edit across the full
catalog/driven variants and agree with direct engine results/time. Scope checks now
assert unchanged native epoch and continuous raw times through supported edits.
JS syntax and `git diff --check` pass. No browser/visual verification under recorded
user preference; no deployment or commit. Preserve accumulated uncommitted work.

## Scope history across circuit edits — 2026-11-16 (latest)

User wants oscilloscope acquisition to continue when components are placed/moved.
Scope view previously cleared its buffer on every loading state and worker/solver
epoch change, causing traces to restart when electrical edits replaced the solver.

Coordinator now publishes an acquisitionEpoch independent of worker runEpoch. It
changes only for a different document ID or explicit Reset. Scope `followState`
clears history on those acquisition boundaries, suspends acceptance during loading/
invalid edits without discarding samples, then resumes with the new guarded worker
identity. Pure layout moves retain the same worker and timeline as before.

When an electrical edit rebuilds the solver with time zero, the scope retains its
old samples and offsets the new segment onto its continuing acquisition time axis,
starting one sample interval after the previous segment. Within each segment,
original sample spacing is retained. Actual engine time, frame/sample DTOs and
recorder exports are unchanged. This is display acquisition continuity, not a new
mechanism for migrating capacitor/inductor state across topology rebuilds. Live
voltage/contact edits still preserve physical time/state as previously recorded.
Explicit Reset, a different document, disposal and probe-target/channel changes
retain their deliberate clear/restart behavior; Clear removes samples without
allowing stale-frame replay. Existing session/revision/sequence guards remain.

Verification: all 21 non-browser suites pass (previous 20 including orientation,
plus `node tools/test_scope_continuity.mjs`). New real-engine coordinator/scope
checks cover layout moves, component placement, repeated circuit replacements,
retained sample values, monotonic acquisition timestamps, raw engine timestamps,
invalid-edit suspension and stale-frame rejection after Reset/document changes.
JS syntax and `git diff --check` pass. Built frontend refreshed; no Java changes.
No browser or visual verification under recorded user preference; no deployment.

## Upright component labels/icons — 2026-11-16 (latest)

Component-contained text now counter-rotates/unmirrors around its own local anchor,
so label positions follow their associated pin/body while glyphs stay readable.
Shared `symbol-orientation.js` handles placed parts and placement ghosts. Source
waveform icons and variable-voltage arrow stay upright about the source center;
DC +/− glyphs stay upright individually while retaining their terminal-side positions.
Component body/leads/pins and directional electrical markings (e.g. current arrows,
diodes, transistor arrows) still transform normally. Standalone text annotations
retain their explicit rotation; this change targets text inside component symbols.

Verified non-browser transform math for all quarter-turn/mirror combinations:
anchors follow body geometry and glyph axes remain upright/unmirrored. New
`node tools/test_symbol_orientation.mjs`, existing editor-model/menu checks, JS
syntax and `git diff --check` pass. Refreshed built frontend files (no Java changes).
No browser or visual verification under the recorded user preference.

## Fresh placement orientation — 2026-11-16 (latest)

Choosing a placement component now resets its rotation/mirror to its default,
including reselecting the same type. The reset is centralized in editor `setTool`,
covering both the component list and A menu. The special op-amp (+ on top) retains
its intended 180°/mirrored default. Repeated placements without choosing another
tool retain the rotation chosen for that placement session. Existing parts are
unaffected. JS syntax and component-menu checks pass; updated built frontend.
No browser/visual verification under the recorded preference.

## Variable-voltage drag continuity — 2026-11-16 (latest)

User clarified that every slider step felt like a simulation reset. The electrical
source already uses native `VarRailElm` with its headless voltage getter and a live
parameter mutation. RC/time/epoch checks confirm the source is not reloaded on
voltage-only changes. The interaction path nevertheless blanked readings on each
revision, deferred physics by another display interval, and could queue redundant
worker updates. Those effects made live dragging look like repeated resets.

Fixed the drag path:
- `voltage-slider.js` is a small DOM-independent controller loaded before editor.js.
  It coalesces input within an animation frame and keeps at most one preview in
  flight, with only the newest unsent value retained. Release commits one history
  entry; returning to the original value still restores the physical source even
  when the model transaction is a no-op. Pending frames are cancelled on commit,
  cancellation or unrelated edits. Escape/pointer cancellation restores saved
  value; ordinary focus loss/tool changes finish the current adjustment.
- The coordinator replaces the old periodic timer with a zero-delay solve after
  the latest running live update completes. Rapid input cannot keep deferring
  the next physics batch by a full interval. Explicit Pause remains respected.
- `CircuitSimulation.presentationFrame` permits the last sampled reading to stay
  visible only within the same accepted session/document/run epoch during a live
  update. Revision-gated authoritative `state.frame` remains unchanged; loading,
  error, disposal and changed epochs do not reuse presentation data. The editor
  keeps compiled terminal mapping while the updated source value is being applied.
- Committing a slider value retains the native range DOM element and focus, so
  keyboard adjustments do not lose focus after the first change. Inspector summary
  updates without replacing the control. Per-preview status messages are removed.

Verification: all 19 non-browser suites pass (previous 18 plus
`node tools/test_voltage_slider.mjs`). New tests cover bounded/coalesced preview
queues, final/no-op restore, cancellation and history, and 50 consecutive native
source edits through a real compiled RC circuit: every solve advances time, follows
the expected charge recurrence and retains the same worker/epoch. They assert
prompt timer scheduling, Pause behavior and presentation-frame invalidation.
JS syntax and `git diff --check` pass. The refreshed cached Java/GWT engine/worker/
site build includes the new control script. No browser use or visual verification
under the recorded preference; no deployment/commit.

## Continuous editing and default Run — 2026-11-16 (latest)

User wants Falstad-style operation: run by default, retain Run through edits,
allow disconnected/floating components, and operate sliders/switches during Run.
This supersedes prior strict floating-island rejection, pause-on-replacement/reset,
and push-switch reset notes below. Preserve accumulated uncommitted work.

Coordinator now defaults `autoRun: true`. Run/Pause is persistent intent: layout
edits reuse the session, electrical replacements cancel the pending tick/drain the
current batch, install the new solver, and automatically schedule again when Run
was selected. Reset likewise retains Run/Pause. Explicit Pause during installation
wins; old push-release callbacks cannot restart it. Temporary document validation
errors suspend stepping but retain intent and recover on the next valid edit.
Actual worker/solver faults and StopTrigger still stop scheduling. Deterministic
manual-step consumers/tests opt into `autoRun: false`; editor uses the new default.
Run/Pause can be selected while a circuit is loading or temporarily invalid.

Voltage-only changes and ordinary SPST switch changes retain their live FIFO path.
Added guarded `setContact` through host/adapter/protocol/coordinator for push,
SPDT, DPDT, MBB switches and logic input state. A sole state-field change uses the
same worker/epoch, preserving simulation time and stored dynamic model state;
other property/topology edits still rebuild/reset and resume automatically. Push
press/release remains a transient overlay, excluded from save/history. Generic
state changes validate the complete resulting projection before touching the
engine; existing ideal-source/contact/capacitor loop guards remain.

Adapter no longer requires an explicit ground or rejects floating islands. It
retains their real terminals and delegates to the original solver's existing
100 MΩ floating-node references. FLOATING_NET and UNCONNECTED_PIN are warnings.
Open ideal current sources use the existing high-resistance fallback with an
OPEN_CURRENT_SOURCE warning instead of blocking the whole document. No physical
solver equations changed. Floating-node potentials are approximate references,
matching original Falstad behavior. Truly invalid ideal loops/model parameters or
physical solver failures can still suspend/stop stepping; a loose resistor cannot.
Empty/annotation-only documents still have no circuit to simulate, retaining intent
until an electrical component is added. Topology replacement does not yet migrate
capacitor/inductor state between solver instances; pure layout and live state edits do.

Verification: fresh cached Java 8/GWT engine, worker and site build; all 18
non-browser suites pass (previous 17 plus `node tools/test_running_edits.mjs`).
New tests exercise auto-start, moving without resetting time, loose resistor and
wire disconnection/reconnection, Run across replacements/reset, Pause during
installation, invalid-edit recovery, voltage changes during an in-flight batch,
and all live switch/input state operations. Dedicated Node worker also agrees
with direct engine results after live contact edits. Previous floating-rejection
tests now check warnings. JS syntax and `git diff --check` pass. No browser use,
screenshots or visual QA under the recorded user preference; no deployment/commit.

## Variable Voltage and Outputs/Labels — 2026-11-16 (latest)

Latest user direction: skip remaining passives for now; add Variable Voltage, then
remaining Outputs and Labels. This supersedes the passive-first continuation below.
Preserve all accumulated uncommitted work in the separate `new-sim` worktree.

Implemented 19 additions, bringing the editor/document catalog to 65 models (three
are inert graphics). All 20 original Outputs and Labels menu entries are enabled;
Inputs and Sources is 9/17 and Passive Components remains 13/24. Added:
- Variable Voltage: editable signed min/max/value and label; Inspector slider.
  Voltage-only changes use a guarded FIFO live worker operation between batches,
  preserving time, capacitor state and running status. Slider drags use a transient
  overlay and commit one history entry. Range/other parameter edits reset normally.
- Lamp, text, box, line, labeled node, voltmeter/scope probe, ohmmeter, ammeter,
  wattmeter, test point, decimal display, instruction display, 8×8 LED array,
  data export, audio output, stop trigger, DC motor and three-phase induction motor.
- AC sources now accept optional phase (radians in documents, degrees in Inspector),
  allowing balanced three-phase drives. Zero/absent phase have the same identity.

Reuse original Java model equations. `EngineOutputSupport.java` guards host records,
extracts bounded measurement/capture DTOs and initializes UI-dependent helpers.
Variable rail/audio constructors skip legacy UI creation when running headless.
Instruction display subclasses only the old bus post geometry into four stable
independent pins; it retains the old lookup/display code. No general bus model or
legacy importer is introduced.

Text/box/line are saved/history-aware editor components omitted from electrical
projection; annotation edits preserve the engine session. Box hit testing covers
its outline, allowing components inside it to remain selectable. Named nodes join
by exact case-sensitive names before net compilation; private legacy label names
prevent redundant alias loops. An annotation-only document is editable but has no
electrical circuit to simulate. Private compiler spacing is now 512 to fit LED pins.

Inspector shows measurements and provides voltage probe plotting, recorder CSV,
audio playback/WAV. Capture reads do not advance time and reject stale session
responses. Data captures use simulation timestep timestamps; audio uses its sample
interval. Playback/WAV removes DC and normalizes peak amplitude to .2. Stop triggers
truncate bounded/sampled stepping and pause Run normally without faulting the worker.

Supported limits: decimal/instruction displays have four inputs; LED array is fixed
8×8 with instantaneous brightness (no persistence-of-vision rendering). Probe/test
point modes cover instantaneous/RMS/max/min/peak-to-peak/binary, excluding legacy
wall-clock frequency modes. Wattmeter average is the original extrema-based estimate,
not an exact cycle-integrated power average. Wattmeter has current and return pairs;
its return pair is internally shorted, so do not also externally short both pins.
Motor equations/units remain legacy; this does not add mechanical shaft wiring.
Meters/recorders retain original electrical loading; ohmmeter actively excites its
circuit. General original UI variants and browser interactions are not certified.

Validation completed against a freshly compiled engine/worker/site using cached
Java 8/GWT dependencies (`tools/build_engine_cached.py`). All 17 non-browser
suites pass: editor_model, document_adapter, simulation_coordinator,
continuous_simulation, scope_model, scope_sampling, component_catalog,
component_expansion, passive_switch_components, logic_display_components,
flip_flop_components, chip_batch_components, component_menu,
passive_menu_components, component_worker, output_family, output_coordinator
(run each with `node tools/test_NAME.mjs`). New checks include all 19 model
schemas/transforms/history/reset, inert graphics/named nets, live RC voltage
continuity, analytic instantaneous/RMS/extrema meters, lamp/RL motor limits,
reversed balanced three-phase rotation, all four-bit display values, LED loading,
bounded ring capture timestamps/CSV/WAV/reset, normal trigger pauses and stale
capture replies. The compiled dedicated worker matches direct engine frames,
measurements and captures. JS syntax checks and `git diff --check` pass.
Legacy pot endpoint diagnostics remain nonfatal as recorded in prior checkpoints.
No browser automation, screenshots or visual QA under the recorded user preference.
No deployment or commit. Remaining passives are deferred; further source families
or broader display/options support can follow when requested.

## Menu-order passive expansion — 2026-11-16 (latest batch complete)

Latest user priority: complete Passive Components, then Inputs and Sources, then
Outputs and Labels in context-menu order, ahead of further digital chips. This
supersedes earlier next-chip recommendations. Work reuses existing electrical
models and adds the new editor/document/worker integration and tests.

Added the first five missing passive entries, bringing the catalog to 46:
- `pushSwitch@1`: a/b; normallyClosed boolean. Engine record s with momentary=true.
  Holding in Select inverts the contact in a transient document copy; release,
  cancellation, lost pointer capture, Escape/tool changes or focus loss restore
  the saved rest state. Save/autosave/history retain the rest state. Shift-click
  selects; M/G moves; E/Inspector/double-click edits. Contacts replace/reset the
  worker and resume Run when appropriate. No charge/time continuity or guaranteed
  capture of presses shorter than worker replacement is claimed. The new physical
  pointer gestures have not been browser-verified under the recorded preference.
- `mbbSwitch@1`: common/a/b; four positions A → A+B → B → A+B. Single click cycles;
  properties select position. Ideal contact/source loops rejected, including both
  simultaneous paths. No linked switch groups or finite on resistance in this slice.
- `tappedTransformer@1`: primary p1/p2, secondary s1/tap/s2. Editable primary
  inductance, full secondary/primary turns ratio, coupling and integration.
  Defaults 4 H, 1:1, .99, backward Euler. Centered tap; zero initial winding currents.
- `customTransformer@1`: two primary windings p1a/p1b and p2a/p2b, one secondary
  sa/sb. Fixed six-pin arrangement, signed nonzero turns1/2/3, base inductance,
  coupling and integration. Defaults 1,1:1, 4 H, .999, backward Euler. General
  description editing, extra windings and shared taps remain unsupported. Numeric
  exponent '+' is removed from compiled turns so the legacy parser cannot mistake
  it for a winding tap; the raw host rejects ambiguous descriptions and unsafe
  inductance/coefficient ranges. No electrical equations were changed.
- `transmissionLine@1`: left/right signals and two return pins that must explicitly
  connect to global ground. Delay and characteristic impedance, defaults 1 ms/75 Ω.
  Lossless model, delay floored to 1..100000 document timesteps. Private width 32.
  Host resets delay buffers after setting the new document timestep so a previously
  loaded circuit cannot determine their length. No losses/floating returns or
  per-port current results are exposed.

All have symbols, properties, validation, compiler/post mapping and worker
capabilities; menu entries now enable their actual tools. Multi-winding/two-port
models omit an ambiguous aggregate current; push current is a-to-b. Existing graph,
rotations/flips, contact editing, copying and history are reused. Magnetic coupling
never provides another winding's conductive ground/return path.

Verification:
- Fresh Java, browser-engine GWT and DOM-free-worker GWT builds pass with the cached
  helper and temporary Java 8/cache; local compiler sockets authorized outside the
  sandbox. No downloads. Preview source assets refreshed in build/engine-site.
- All 15 non-browser suites pass: previous 14 plus
  `node tools/test_passive_menu_components.mjs`. New checks cover overlay save/history
  isolation, NO/NC contact states, all four MBB positions, independent coupled-winding
  matrix/nodal solutions for both integrators, ratios/polarities and driven windings,
  matched-line step delay and changed timestep/reset, scientific turns encoding,
  projections/geometry/history/copy, isolated windings, ideal loops and raw guards.
- Actual Node worker checks include all five new models and driven/options variants,
  sampled transmission-line arrival and direct/worker agreement. Six historical
  numerical baselines still pass at 1e-12. Existing documented pot endpoint diagnostics
  remain; no new matrix diagnostic in valid new cases.
- JS syntax and git diff --check pass. Browser runner definitions point at the next
  unavailable passive item (Relay), but no browser automation/screenshots/visual QA
  were performed. This is not a claim that the new push input gestures were tested
  in a browser.

Current menu availability (base variants/presets, not unique electrical models):
Passive Components 13/24; Inputs and Sources 8/17; Outputs and Labels 2/20.
Next missing passive entries: Relay, Relay Coil, Relay Contact, then Photoresistor,
Thermistor, Memristor, Spark Gap, Fuse, Crystal, Cross Switch and Gyrator. Check
bundled source availability before enabling every menu entry (some references may
be stale). Finish passives before the remaining source and output/label groups.
Full category/catalog coverage, import and example browsing remain open.

All accumulated work remains uncommitted after `d28fa8e9`; nothing deployed.

## Falstad Add menu and next chip batch — 2026-11-16 (latest, complete)

User requested the original Falstad Add-menu hierarchy before continuing counters,
latches and combinational chips. Implemented without discarding the accumulated
OpenCode/earlier work. Source/docs/tests remain uncommitted after `d28fa8e9`.
Nothing deployed.

A/Add now opens a popup using the exact root/submenu labels, component entry names
and ordering from this fork's Menus.composeMainMenu. There are 14 root entries
and 148 leaf entries including legacy editor actions. Generated data lives in
`experiments/engine/legacy-component-menu.js`; regenerate with
`python3 tools/generate_component_menu.py`. Separate `component-menu.js` maps
supported entries to tools. Pointer hover/click and keyboard arrows/Enter navigate
submenus; Escape/outside click close. Long panels scroll and narrow views allow
horizontal panel scrolling. The flat search chooser is replaced. Unimplemented
models and unsupported legacy editor actions remain visible, unavailable with an
explanation; they cannot select a substitute tool. The Subcircuits menu is present
but empty: dynamic legacy subcircuit loading is not implemented. Voltmeter/Scope
Probe remains disabled rather than substituting the toolbar's voltage-marker tool.

The supported source model also gains Square Wave and Clock placement presets;
Clock defaults to 0–5 V at 100 Hz. The alternate ideal op-amp menu entry places the
existing op-amp vertically flipped so + is on top. Menu parity targets bundled
source only and is not a full simulation-compatibility claim.

Added four models, bringing the catalog to 41:
- `counter@1`: four-bit counter, clock/reset/Q3..Q0, initialValue, modulus 0..16
  (0 = natural 16), active-low/high reset and rising/falling edge selection.
- `latch@1`: four-bit latch/register, I0..I3/O0..O3/load, initialValue and
  rising-edge register versus transparent-while-high latch mode.
- `halfAdder@1`: A/B/sum/carry, single-bit XOR/AND.
- `fullAdder@1`: four-bit A/B/S plus carryIn/carryOut.

All expose positive logic voltage, use unchanged legacy model equations and omit
an ambiguous aggregate current. Fixed-width schema variants only: no variable bit
counts, bus pins, up/down/loadable counters, latch set/reset/output enables or
propagation delay. Inputs sample the previous solved voltages. In particular, the
active-low counter reset initially sees zero and clears a saved nonzero value
before its external high rail is first solved. This legacy startup behavior is
retained/tested, not hidden by priming extra steps. See DOCUMENT-ADAPTER.md for
records, post mapping, output-source preflight and precise parameters.

Chip symbols now show edge/reset indicators and fit their pin heights. Hit testing
covers the whole chip body, fixing the previously recorded JK body-end miss.
Repeated-clock tests from the recovery review are retained in the flip-flop suite.
The generic grid assertion now treats -0 modulo 16 as zero, allowing tall chip
pins at negative coordinates without falsely failing grid alignment.

Verification completed:
- Fresh Java, browser-engine GWT and DOM-free-worker GWT builds passed via the
  cached build helper using the temporary Java 8 JDK/cache. Local compiler sockets
  were authorized outside the sandbox. No downloads. Frontend preview assets are
  refreshed under build/engine-site. The normal makeEngineSite example copy rule
  now includes all JSON examples, matching the cached helper.
- All 14 non-browser suites passed: the previous 12 plus
  `node tools/test_component_menu.mjs` and `node tools/test_chip_batch_components.mjs`.
  Menu tests check generated/source hierarchy and every component label, availability
  and source/orientation presets. Chip tests include the exhaustive half-adder and
  512-case four-bit adder truth tables, counter clocks/reset/modulus, transparent/
  edge-triggered latch data waveforms, initial state and custom voltage, canonical
  roundtrips, geometry/hit bounds/history/copy, topology and raw-loader guards.
- Actual Node worker tests include all four chips, custom voltages, counter/latch
  options and per-step waveform sampling with direct/worker agreement. All six
  historical numerical baselines still pass at 1e-12. The older documented pot
  endpoint diagnostics remain; no new chip matrix diagnostics in the valid cases.
- JS syntax and git diff --check pass. Browser input test definitions now use the
  hierarchical menu, but were NOT run. No browser automation/screenshots/visual QA,
  preserving the recorded preference. Actual popup input/layout remains unverified
  in a browser; the source/menu data and model/engine checks are non-browser checks.

Next component batch: multiplexer/demultiplexer and remaining digital chips, then
return to pending tapped transformers/mechanical switches and analog/specialized
families. Full component parity, legacy text import and example browsing remain
open. No commit or deployment performed.

## OpenCode recovery review — 2026-11-16 (current)

Compared the latest notes with the working tree. OpenCode added six models after
the 31-model milestone: output, logicOutput, logicInput, dFlipFlop, jkFlipFlop and
tFlipFlop. Editor definitions and adapter catalog now contain 37 models. No next
component family appears partly implemented; the latest notes end at the completed
base flip-flop batch. Accumulated source/docs/tests remain uncommitted after
`d28fa8e9`, including the earlier passive/controlled-switch work. Preserve them.

All twelve non-browser Node suites passed again, as did JS syntax and whitespace
checks. Numerical/worker checks used the existing generated engine; no fresh
Java/GWT build was run during this review. No browser/visual checks. An additional
temporary Node check exercised 1,200 steps per case: D with changing data, T with
T high, JK with J/K high and both edge polarities, each from both initial states.
All eight cases passed across 12 clock edges each, accounting for the legacy
previous-step input sampling. This extra check is not yet a committed regression
test; the checked-in flip-flop suite still uses static clock rails.

One confirmed editor gap: the JK symbol extends to y=±48 but component body hit
testing still uses the generic ±24 height. Clicking the body 40 units below its
center returns no hit. Extend chip body hit bounds before treating its editing
integration as fully polished. No implementation changes made during this review.

Suggested continuation: retain repeated-clock regression coverage and fix chip
body hit bounds, then continue counters/latches/combinational chips as recorded
below. Tapped transformers and remaining mechanical switches remain pending.

## Flip-flop batch — 2026-11-16 (latest, complete)

Added the three base legacy chips used by the bundled sequential examples,
bringing the document/editor catalog to 37:

- `dFlipFlop@1`: `D`, `Q`, `Qn`, `clock` pins; emits legacy `155`.
- `jkFlipFlop@1`: `J`, `clock`, `K`, `Q`, `Qn`; emits `156`.
- `tFlipFlop@1`: `T`, `Q`, `Qn`, `clock`; emits `193`.

All three expose positive finite `highVoltage` (default 5 V) and boolean
`initialState` (default low). `initialState` maps to the legacy trailing Q/Q̄
state volts (high/low), so the stored state is restored on the first step.
`jkFlipFlop` also exposes boolean `positiveEdge` (default false, the legacy
negative-edge default); true sets ChipElm POSITIVE_EDGE (4). A custom
`highVoltage` sets CUSTOM_VOLTAGE (8192) and adds the leading voltage field;
otherwise it is omitted. SMALL (1) is not emitted. D-flip-flop set/reset
variants, the small-chip flag and other chip families are intentionally not
included; the guarded loader rejects their flags.

Chip outputs are implicit ground-referenced ideal voltage sources. Preflight
seeds both `Q`/`Qn`, rejects shorts between complementary outputs or to
ground, counts them as return paths for ideal current sources and as reference
reachability, but does not let them satisfy the explicit-ground rule for
otherwise floating circuits. Inputs are high-impedance and need an external
ground-referenced path. No aggregate component current is exposed (`sign:
null`). Canonical legacy geometry is `x 32 x+64 32` with posts
`(x,32),(x+96,32),(x+96,96),(x,64)` for D/T and
`(x,32),(x,64),(x,96),(x+96,32),(x+96,96)` for JK. The loader validates 8/9
field counts, allowed flags, positive finite logic voltage, exact `y1==y2` and
`x2-x1==64` geometry, and complementary Q/Q̄ state values.

The editor adds palette/chooser entries, chip symbols with J/K/D/T/clock/Q/Q̄
labels, a live `Q H/L · voltage` label, value text, and properties for logic
voltage, initial state and JK edge. Contacts, rotation, flips, copying and
undo/redo reuse the existing graph implementation.
`docs/new-simulator/examples/flip-flop-latch.json` drives a D flip-flop from a
static clock rail; the build copies it to the preview.

Verification completed:
- Fresh Java compilation plus browser-engine and DOM-free-worker GWT compilation
  passed with `tools/build_engine_cached.py`; `build/engine-site` is refreshed.
- All twelve non-browser Node suites passed: the previous eleven plus
  `node tools/test_flip_flop_components.mjs`.
- New checks cover D/T/JK state restore and edge behavior, custom logic voltage,
  complementary outputs, record flags/state, grid rotation/flips, undo/copy,
  ideal-output-loop and floating-island preflight, parameter validation and
  raw-loader guards.
- `node tools/test_component_worker.mjs` includes the three models (plus a
  positive-edge custom-voltage JK case) with real Node worker/direct agreement;
  the earlier suites and six historical numerical baselines still pass
  (1e-12 tolerance).
- No stamping or component equations changed. No browser automation,
  screenshots or visual QA, per the recorded verification preference. No commit
  or deployment.

Remaining limits: base variants only (no D set/reset pins or small-chip flag).
Tests drive static clock rails, so one rising edge occurs per load (the D
flip-flop defers its first execute after load, while the T flip-flop toggles on
it). Next component families are counters, latches and combinational chips, then
the tapped-transformer/mechanical-switch batch. Full component parity and legacy
import remain open.

## Logic/display I/O batch — 2026-11-16 (historical, complete)

Added the three legacy display/logic I/O models used by the bundled examples,
bringing the document/editor catalog to 34:

- `output@1`: one `in` pin and boolean `showVoltage` (default true). Emits the
  legacy `O` marker; it has no electrical effect and no single current mapping.
  `OutputElm` fixed-scale/precision (`scale`/`FLAG_FIXED`) is intentionally not
  exposed in this slice.
- `logicOutput@1`: one `in` pin, finite `threshold` (default 2.5 V), `mode`
  (`logic`/`numeric`/`ternary`, default `logic`) and boolean `pulldown` (default
  false). It is a read-only probe; when enabled, `pulldown` adds the legacy 1 MΩ
  resistor to ground. Levels follow LogicOutputElm: L/H, 0/1, or 0/1/2 using
  threshold halves for ternary. The element reports that pulldown as an implicit
  ground connection, so legacy loop/path analysis (for example, an ideal current
  source whose only return path is the pulldown) sees it as a real return path.
- `logicInput@1`: one `out` pin, integer `state`, finite `highVoltage`/`lowVoltage`
  and the same `mode`. It is a ground-referenced ideal voltage source using the
  unchanged LogicInputElm equations; ternary level is
  `lo + state*(hi-lo)/2`. Defaults are state 1, 5 V high, 0 V low, logic mode.
  State/mode edits use normal replacement/reset; mode `ternary` permits state 2.
  `momentary` push-button behavior is intentionally not exposed.

Flag encoding: `O` uses VALUE (`showVoltage`); `M` uses TERNARY=1, NUMERIC=2 and
PULLDOWN=4 plus a trailing threshold; `L` uses TERNARY=1/NUMERIC=2 with
`state false high low`. The guarded Java loader accepts and validates these field
counts/flags in addition to the older 6/7/8-field forms. The compiler treats
`logicInput` like a voltage rail for implicit reference, ideal-source-loop and
current-source return-path preflight, and maps its current sign as `-1` (the same
delivery convention as a rail). A lone display-only marker is seeded into the
floating-island reachability set, so it is valid on its own; that exception does
not extend to passive islands attached to a marker. `logicInput` is reached through
its implicit ground link, so it needs no special seeding.

The editor adds palette/chooser entries, symbols, properties and live labels: an
`output` shows its voltage when enabled; a `logicOutput` shows its L/H, 0/1 or
0/1/2 level plus voltage; a `logicInput` shows its state and can be cycled by a
single click. Properties expose show-voltage, threshold/mode/pulldown, or
state/high/low/mode. Contacts, rotation, flips, copying and undo/redo reuse the
existing graph implementation. `docs/new-simulator/examples/logic-monitor-divider.json`
demonstrates a divider feeding `O`/`M` and a driving `L`; the build copies it to
the preview.

Verification completed:
- Fresh Java compilation plus browser-engine and DOM-free-worker GWT compilation
  passed with `tools/build_engine_cached.py`; `build/engine-site` is refreshed.
- All eleven non-browser Node suites passed: the previous ten plus
  `node tools/test_logic_display_components.mjs`.
- New checks cover `O` electrical invisibility, `M` L/H/numeric/ternary levels and
  pulldown loading, `L` all states and custom/ternary voltages, current sign,
  legacy record flags/trailing parameters, lone-island acceptance, parameter and
  ideal-source-loop rejection, projection roundtrips, grid rotation/flips,
  history/copy and raw-loader validation.
- `node tools/test_component_worker.mjs` now includes the three models with real
  Node worker/direct agreement. The other suites and six historical numerical
  baselines still pass (1e-12 tolerance).
- No stamping or component equations changed. No browser automation, screenshots
  or visual QA, per the recorded verification preference. No commit or deployment.

Remaining limits: `output` has no scale/fixed-precision option; `logicInput` has no
momentary button; `logicOutput` is a marker, not a logic driver; no per-terminal
current UI. Next component families are sequential logic/chips, then the remaining
analog/specialized types. Full component parity and legacy import remain open.

## Passive/controlled-switch batch — 2026-11-16 (historical, complete)

User authorized continuing the remaining component families and keeping this
handoff current. Added three document/editor models, bringing the catalog to 31:

- `polarizedCapacitor@1`: positive/negative terminals, capacitance, initial voltage,
  BE/trapezoidal integration and a nonnegative maximum reverse voltage (default
  1 V). Uses legacy PolarCapacitorElm; excess reverse bias stops the simulation.
  No ESR setting or physical breakdown/failure simulation in this slice.
- `analogSwitch@1`: voltage-controlled SPST with a/b/control pins.
- `analogSpdtSwitch@1`: voltage-controlled SPDT with common/a/b/control pins.
  Both expose on/off resistance, control threshold, inversion and pulldown options.
  Default 20 Ω / 10 GΩ, 2.5 V, non-inverted, pulldowns enabled. Controls are
  ground-referenced, non-loading and require an external reference path. Without
  pulldowns the inactive path uses off resistance; with pulldowns it disconnects
  and the signal terminals/throws have off resistance to ground. Public current
  follows the legacy selected signal path and omits separate leakage/pulldown
  currents. Parameter edits replace/reset; control waveforms switch during a run.

Includes chooser entries, symbols, property fields, validation, stable pin mapping,
projection roundtrips and capability advertisement. Normal contacts, rotation,
flips, copying and undo/redo use the existing graph implementation. JSON examples
`polarized-capacitor-rc.json` and `analog-spdt-selector.json` are in examples/ and
copied to the generated preview. Legacy import/example browsing remain deferred.

Structural fixes discovered by numerical checks:
- Initialize the private engine grid mask/round as well as gridSize, so legacy
  controlled-switch geometry snaps to the compiled post coordinates.
- AnalogSwitch2Elm keeps both possible signal paths in its matrix partition via
  getMatrixConnection, independently of its active getConnection. This avoids
  cross-matrix stamping when selecting the other throw with pulldowns enabled.
- Return immediately if stepFinished stops the simulation, before reading retired
  matrices or emitting a sample. Excess reverse bias now reports the legacy
  diagnostic instead of a null-matrix exception. Faulted protocol workers still
  require replacement; fresh-worker recovery is tested.

No stamping or component equations were changed. The legacy analog-switch timing
is retained: doStep reads the previously solved control voltage, so signal switching
follows a control waveform transition by one electrical step.

Verification completed:
- Fresh Java compilation and browser-engine/DOM-free-worker GWT compilation passed
  with `tools/build_engine_cached.py`; build/engine-site is refreshed. The initial
  sandbox attempt failed on the local GWT compiler socket, then the authorized
  build outside the sandbox passed. No dependency downloads were needed.
- All ten non-browser Node suites passed: the previous nine plus
  `node tools/test_passive_switch_components.mjs`. New numerical checks cover both
  capacitor integrators/initial states, analytic backward-Euler RC, ordinary-cap
  agreement at 1e-12, reverse limits/stops, all switch control states and threshold
  boundaries, inversion, pulldowns, custom resistances, dynamic transitions, control
  input current, reset, malformed loader records and topology rejection.
- Real Node worker checks cover all 24 additions since the original seven models,
  including dynamic per-step sampling, direct/worker agreement, reverse-voltage
  fault reporting and fresh-worker recovery. Six historical numerical baselines
  still pass at absolute tolerance 1e-12. The older potentiometer endpoint matrix
  diagnostics remain; no controlled-switch matrix diagnostics remain in this suite.
- JS syntax checks and git diff --check pass. No browser automation, screenshots
  or visual QA, preserving the user's recorded verification preference.

Machine-specific build invocation used here (do not assume these paths travel):

```sh
python3 tools/build_engine_cached.py --java-home /tmp/circuitjs-jdk8/zulu8.98.0.111-ca-jdk8.0.512-macosx_aarch64/Contents/Home --cache /tmp/circuitjs-gradle/caches/modules-2/files-2.1
```

Source/docs/tests are uncommitted on new-sim after `d28fa8e9`; nothing deployed.
The next batch recorded at this checkpoint was superseded by the logic/display
batch above. Remaining order after that: sequential logic/chips, then other
families. Full Falstad component coverage remains open; the regenerated catalog
lists pending bundled types.

## Recovery check — 2026-11-16 (current)

Checked the source against the component-expansion notes after a machine change.
The `new-sim` worktree starts clean at `d28fa8e9` (`added more components`), matching
the locally recorded `origin/new-sim` ref. No remote fetch was performed. The
original `circuitjs` worktree is clean on `master` at `c2cd5dc2`. Earlier statements
below about accumulated uncommitted work are historical: that work is now committed.

The editor definitions and document compiler each contain 28 component models.
The last implemented family is transformer, SPDT/DPDT switches, LED and Zener,
exactly as described in the last section below. No additional partial component
implementation is visible in tracked or untracked working-tree files. Work that
was never saved or transferred from the home machine cannot be inferred here.

All nine non-browser Node suites passed again: editor model, document adapter,
simulation coordinator, continuous simulation, scope model, scope sampling,
component catalog, component expansion and real Node worker checks. Numerical and
worker checks used the existing generated `build/engine-site` worker bundle; this
recovery check did not rebuild it. The system Java lookup cannot find a Java 8
runtime, so fresh Java/GWT compilation still needs a local JDK configured. The
previously recorded nonfatal potentiometer matrix diagnostics remain present.
No browser checks, screenshots or visual QA were performed.

Current priority remains adding the remaining bundled Falstad component families
while retaining the existing simulation equations. Full catalog support is not
complete. Next concrete family: polarized capacitors and additional passive/switch
variants, followed by sequential logic/chips and specialized devices. Legacy text
import and example browsing remain deferred behind component support. The static
140-menu-class inventory is a migration checklist, not 140 equivalent document
models or a runtime compatibility claim.

The sections below retain the development history; this recovery check supersedes
their old Git-state and next-task statements where they conflict.

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

### 2026-11-16 intermediate batch checkpoint (historical)

The three new models are implemented in schema/compiler/editor/capabilities and
accepted by the guarded Java loader. Fresh Java and both GWT builds succeeded
using the temporary JDK/cache, with local compiler sockets allowed outside the
sandbox. Numerical checks exposed two pre-existing host/engine structural gaps:
private grid mask/round were not initialized, and a model stopping in stepFinished
was followed by a read of retired matrices. Both are corrected. Controlled SPDT
also needs both possible throws in its matrix partition when pulldowns are enabled;
getMatrixConnection now represents both possible signal paths, independently of
its active electrical getConnection. Stamping and component equations are unchanged.
At this checkpoint the corrected build and expanded numerical tests were still
being checked; the completed results are recorded at the top of this handoff.
