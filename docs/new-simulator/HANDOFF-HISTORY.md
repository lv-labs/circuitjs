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


## Archived scope UI iterations — 2026-11-17

These notes record the implementation sequence, including rejected/superseded UI
and cursor behavior. They are historical, not current requirements. The current
contract, persistence checkpoint and next work are in HANDOFF.md.

## Cursor interaction reversed — 2026-11-17

The user reversed the two modes: ordinary hover fixes the cursor at the pointer's
plot position, continuously reading new samples; click-and-hold latches one exact
sample so it moves across the plot with simulation time. Release resumes live
sampling at the latest pointer position. ScopeWorkspace computes the shared sample
for all panes, preserving exact timestamp synchronization. This supersedes the
interaction described below. TypeScript/build passed; no browser verification.

## Click-and-hold cursor sampling — 2026-11-17

Hover retains an exact acquisition timestamp. Holding the primary pointer on the
plot instead fixes the source cursor's horizontal fraction and selects the current
sample passing that point as acquisition advances. ScopeWorkspace computes this
shared timestamp once per frame for every pane/value readout. Releasing commits
the final exact timestamp synchronously and returns to sample tracking; no simulation
pause is involved. Pointer capture supports release/cancel outside the plot, and
normal mouse leave is ignored while held. Clicking a waveform still selects its
trace for the axis. Held state is transient, not saved in the circuit.
Build/TypeScript passed; no browser verification/tests under the low-credit request.

## Cursor value annotation — 2026-11-17

The scale annotations now sit at the top-left of the plot. While the shared exact
cursor sample is visible, they also show the selected axis trace's raw sample value
in its colour and units. No value is substituted outside the pane's sample window.
Build/TypeScript passed; no browser verification.

## Cursors share the exact acquisition sample — 2026-11-17

Scope cursor state now holds an acquisition timestamp, not a relative plot fraction.
Hovering selects the nearest actual sample in that pane by binary search. Every
other pane locates that identical timestamp and draws at its own time-axis position;
it never substitutes its own nearest step. Panes whose visible sample window does
not contain that timestamp hide the cursor. Different pane time scales and widths
therefore remain synchronized to the same sample. Cursor changes do not rebuild
waveform geometry. This supersedes the earlier fraction-linked cursor limitation.
Build/TypeScript passed with the existing size warning; no browser checks/tests.

## Dock panel height cap — 2026-11-17

The entire docked scope panel is capped at 50% of viewport height by both CSS and
resize/auto-stack calculations. Saved oversized layouts and viewport shrinking are
covered by the CSS cap; nested panes scroll inside it. Dragging starts from actual
rendered height rather than an oversized saved preference, avoiding jumps at the
limit. The minimum yields to the cap in small windows. Build/TypeScript passed;
no browser verification performed.

## Mixed horizontal/vertical scope dock — 2026-11-17

Dock layout is now a recursive split tree: a pane can sit beside a vertical stack,
and horizontal/vertical splits can nest. Drag a scope grip to a target pane's
left/right/top/bottom edge; the highlighted half previews the split. Dropping adds
the scope there, collapsing its former empty branch. This supports one full-height
pane on the left and two stacked on the right. Both splitter orientations resize
by pointer or arrow keys. Context menu → Dock layout offers Side by side and Stack
vertically as whole-dock arrangements. Docked grip arrow keys swap neighbouring
leaf positions without flattening the mixed layout.

The optional `layout.scopes.dock` tree saves split axes/ratios and pane IDs; older
files without it reconstruct the previous weighted horizontal arrangement. New
probes append horizontally; absent/deleted/undocked panes are pruned from display
and empty split branches collapse. Layout changes use the existing local previews,
release-time saving and Undo. Core validation bounds tree depth/node count and
checks ratios/duplicate leaf IDs. Large arrangements scroll when minimum pane sizes
exceed the panel. Vertical splits increase panel height where possible.
Build/TypeScript passed with the existing size warning. No browser verification
or tests were run, following the user's low-credit request.

## Floating panel snapping and sheet grid — 2026-11-17

Floating scopes now use the sliders' 12px edge inset and 48px toolbar clearance,
including sizing constraints so panels fit within those margins. Moves and corner
resizes magnetically snap within 10px of screen edges or other floating scope /
slider panel edges, with 12px spacing between neighbouring panels and matching
edge alignment. Target rectangles are cached at gesture start and refreshed when
the surface resizes; normal pan/zoom does not measure them. Helpers live in
`scopeSnapping.ts`. Sliders remain unchanged; scope movement snaps to them.

Sheet scope placement, movement and width/height now snap in world coordinates to
the 50-unit sheet grid. Keyboard handles move/resize by grid increments. Floating
panels continue using pixels; existing layouts snap as they are moved/resized.
The saved workspace captures the resulting geometry on gesture completion.
Build/TypeScript passed with the existing size warning; no browser checks/tests
were run under the user's low-credit constraint.

## Scope grip drag/reorder/docking — 2026-11-17

Docked scopes now have title grips matching undocked scopes. Drag horizontally
within the bottom panel to reorder; drag outside and release to undock as a floating
scope. Undocked floating or sheet scopes can dock by dropping their title grip back
into the panel, at the indicated position. A temporary dock target appears when
needed, including with the panel closed or all scopes undocked. Successful docking
opens the panel. Reorder uses saved optional `panes[id].order`; older files fall back
to probe order and new scopes append after explicitly ordered panes.

A ghost/target label, insertion bars and source dimming show pending placement.
Mode/order changes occur on release so pointer capture stays on a mounted grip.
Escape, pointer cancellation or capture loss cancels the drag. Arrow keys on docked
grips reorder. Normal undocked movement/resizing and sheet navigation remain.
Pointer previews stay local; final layout/order goes through the existing saved,
undoable workspace mechanism. Build/TypeScript passed with the existing size
warning; no browser verification/tests, per the user's low-credit request.

## Navigation over sheet scopes — 2026-11-17

Sheet scope overlays now delegate navigation to the sheet: plain wheel/trackpad
scroll pans, Ctrl/Meta+wheel zooms about the pointer, and middle-drag, Space+drag
or the pan tool can start over a sheet scope. Wheel handling is delegated once on
the shared sheet surface and filters out floating/docked scopes and other panels.
Captured pointer navigation bypasses scope grips/selection gestures until release,
cancellation or capture loss. Space and zoom keys remain available on a focused
sheet scope while Delete and scope-editing shortcuts retain their scope ownership.
Normal selection, title/corner dragging, settings and context menus remain local.
Production build/TypeScript passed with the existing size warning; no browser
checks/tests were run for this follow-up.

## Sheet scopes scale with symbols — 2026-11-17

The user now wants sheet scopes to zoom with the circuit like symbols. Sheet mode
stores position AND dimensions in world coordinates; floating mode retains screen
pixels. Placing onto the sheet captures a reference zoom so initial appearance is
unchanged (no immediate tiny UI), then the entire scope scales by the zoom ratio.
Moving/resizing converts pointer deltas through camera scale, and sheet scopes may
extend beyond the viewport like other sheet objects. Floating windows remain
viewport-clamped. Offscreen culling uses transformed screen bounds. CSS transforms
scale the cached plot without changing local plot geometry, preserving the earlier
pan/zoom performance improvements. Selection/delete and grip/corner controls remain.
This supersedes the earlier fixed-pixel sheet-scope dimensions. Build/TypeScript
passed with the existing size warning; no browser checks/tests were run.

## Scope pan/zoom performance follow-up — 2026-11-17

Investigated the reported navigation lag in source: sheet camera publication was
lifting every pan/zoom into the editor shell, re-creating a ResizeObserver and doing
layout reads each time. ScopeWorkspace also rebuilt group arrays and cropped/copied
all pane samples on every placement/camera render, invalidating waveform caches.

`scopeViewport.ts` now publishes camera through a stable external store, avoiding
editor-shell updates. Docked/floating-only layouts ignore camera notifications;
sheet scopes subscribe for placement. SVG offsets are measured only on actual
resize, with one observer; camera publication occurs before paint. Group membership
and per-pane sample windows are memoized, and memoized ScopeContent components keep
position/selection changes from re-copying samples/rebuilding paths. Fully offscreen
sheet scopes skip plot rendering while shared acquisition continues. SymbolLayer's
selected-ID array is stable across camera changes so its existing memo can skip
symbol reconciliation. AC scaling computes only its needed mean, rather than RMS
and the full statistics set. Acquisition cadence, worker stepping and history remain
unchanged.

Production build/TypeScript passed with the existing size warning. These are
source-level fixes for identified redundant work, not measured frame-rate claims;
no browser profiling or tests were run under current verification constraints.

## Pane time scale, trace vertical scale and selected axis — 2026-11-17

A grid division always means one square of the pane. Time scale (s/div) belongs
to the pane, and all traces in it use that window. Combining adopts the destination
pane's time scale; separating preserves the combined pane's time scale in the new
scopes. Vertical scale/offset belong solely to each trace. Automatic scaling now
fits each trace independently, including small current signals; combining another
trace no longer changes its automatic vertical scale. `traceDisplay` in
`scopeDisplay.ts` is the shared mapping for plotting, context-menu scale changes
and trace-properties defaults.

Click a trace name or waveform to select it for the vertical axis; names are
keyboard-accessible buttons. The selected name is underlined, its waveform is
emphasised, and vertical axis/ticks use its colour, units, scale and offset. The
first remaining trace is the fallback if selection disappears. Opening its gear or
editing its vertical settings also selects it. In AC mode the axis reflects the
mean-removed waveform (marked AC); properties statistics remain raw samples.

Pane right-click menu → Time scale replaces Horizontal scale. Named trace
submenus each expose Use for vertical axis, Vertical scale (Auto-fit this trace /
manual values / zoom) and Vertical position, editing the same metadata as the
properties dialog. Small top-right annotations show pane s/div and selected trace
V/div or A/div. Selected-trace state remains session-only with the scope layout.
This supersedes the earlier shared-by-unit automatic scales and shared/division-only
vertical axis fallback. Production build/TypeScript passed with the existing size
warning; no browser checks/tests were run for this follow-up.

## Stacked labels and trace properties cleanup — 2026-11-17

Combined scopes now stack trace names/gear buttons vertically at the bottom-left,
with aligned button columns and scrolling for long lists. Properties is extracted
to `TraceProperties.tsx`: Appearance (name, colour swatches, optional custom CSS
colour), Scale & position (explicit automatic/manual scale, unit input only in
manual mode, position and coupling), and collapsed Measurements. The AC explanation
appears only for AC. Delete trace sits apart from Cancel/Save changes. Saving remains
one undoable metadata edit; Cancel discards edits. Custom colour syntax and manual
numeric fields are validated. The shared dialog retains focus restoration.
Build/TypeScript passed with the existing chunk-size warning; browser checks/tests
were not run for this follow-up.

## Compact scope trace labels — 2026-11-17

Removed the entire side legend for docked, floating and sheet scopes. The plot
fills its pane; trace names appear in trace colours at the bottom-left, with a
properties gear revealed on name hover/keyboard focus (always available on touch).
Combined scopes list all their trace names there. Readings, scale/offset badges,
RMS/peak-to-peak and visibility checkboxes are no longer shown beside the plot.
Removed the unused visibility state; remaining scope/trace settings and statistics
stay in their context menu/properties popup. Build passed with the existing size
warning; browser checks/tests were not run. This supersedes earlier legend layouts.

## Scope selection and deletion — 2026-11-17

Click/focus selects a docked, floating or sheet scope and shows its selection ring.
Backspace/Delete while that scope has focus, or Delete scope in its right-click
menu, removes all of that scope's probe traces in one undoable core remove command.
Electrical components and wires are retained. Text inputs/editable fields and
menu/dialog typing do not invoke scope deletion; scope key handling stops the
underlying sheet delete shortcut. Outside clicks clear scope selection. Probe/group
assignments are retained so Undo can restore the deleted scope's grouping/layout.
Production build passed with the existing size warning; no browser checks/tests
were run for this follow-up.

## Sheet scope behaviour correction — 2026-11-17

The bottom-panel toggle now only hides docked scopes. Floating and sheet scopes,
including their context menus, remain visible/usable when the bottom panel closes.
“Lock to sheet” is renamed “Place on sheet”: only its anchor uses circuit/world
coordinates. Dimensions, text and controls stay in screen pixels through mode
changes and camera zoom. Sheet scopes follow pan/zoom by position, render below
floating panels, and are clipped to the sheet. They remain selectable, movable by
the title grip/arrow keys and resizable by the corner handle. Selection highlights
the sheet scope and clears on outside clicks. This supersedes the earlier scaled,
non-movable locked mode below. Production build passed with the existing size
warning; browser verification is still pending.

## Scope context menus and sheet anchors — 2026-11-17

The user replaced the pane hover gear/dialog with a right-click menu. Each docked,
floating or sheet-locked pane now opens `ScopeContextMenu.tsx` at the pointer;
Shift+F10 / the context-menu key also opens it from a focused pane. Submenus expose
Horizontal scale (s/div), Vertical scale (auto/zoom/presets) and Vertical position
(up/down/centre/presets). Combined scopes nest vertical controls under each trace
so mixed V/A settings remain explicit. Combine with selects another scope directly;
Separate traces and docking actions no longer need an intermediate dialog. The
individual trace-properties gear remains for name, colour, coupling and detailed
settings/statistics.

Each scope has its own horizontal time window. Acquisition retains the longest
requested window, while pane samples/min/max/RMS are cropped independently; trace
properties opened from a pane uses that pane's time span. Cursor position remains
linked by relative plot fraction, so panes with different time scales can read
different absolute times. Buffer capacity remains bounded; scale choices do not
manufacture older samples. Vertical changes remain undoable probe metadata edits.

Undock offers Floating panel (viewport coordinates, draggable/resizable like the
sliders) or Lock to sheet (world coordinates, follows camera pan/zoom). An undocked
pane can switch modes or dock again from its context menu. Locking preserves the
current screen placement by converting position/size through the published sheet
camera; locked panes cannot be dragged/resized until floated again. Locked content
is clipped to the sheet viewport. `CircuitSheet` publishes camera/viewport offsets
for these HTML overlays. Layout/time-scale/mode remain session-only; no circuit
schema or simulation model changes were introduced.

Production build and TypeScript passed with the existing chunk-size warning. No
browser checks/tests were run; menu placement/focus, nested menu navigation,
independent time scales and camera-following/docking flows need interactive checks.
This supersedes the pane-settings popup and viewport-only undocking below.

## One trace per scope, docked/floating layout — 2026-11-17

The user changed the scope model to match Falstad's default: each new probe creates
its own scope. `ScopeWorkspace.tsx` owns presentation grouping, docked split weights,
panel height, floating positions/sizes, visibility and the scope-settings dialog.
New trace IDs default to their own group. The scope hover/focus gear offers Combine
with scope, Separate traces into scopes for combined scopes, and Undock onto sheet /
Dock below sheet. Trace properties retains individual scale/coupling/measurements.

Docked scopes sit side by side. Drag the thin top edge to resize the whole bottom
panel and vertical dividers to resize adjacent scopes. Many narrow scopes retain a
minimum width with horizontal scrolling. Undocked scopes render as portals over
the sheet, move by their title grip and resize from the bottom-right corner. Focused
handles also accept arrow keys. Floating bounds clamp to the current sheet and
clicked windows come to the front. Scope focus suppresses sheet shortcuts so Delete
or movement keys do not accidentally edit the circuit beneath an overlay.

Layout is session-only, retained when scopes are hidden/reopened and reset on a
circuit-ID change; it is not saved in circuit JSON/local storage. Group membership
is retained across probe removal/undo within that session, and empty groups render
nothing. Docking, grouping and resizing do not change sample channels or clear
acquisition. The Oscilloscope toggle hides/shows both docked and floating scopes.
All shared traces retain synchronized time/cursor data.

Production build and TypeScript passed with the existing Vite chunk-size warning.
No browser checks or tests were run under the handoff verification constraints;
pointer/keyboard drag, split sizing, combine/separate and docking flows still need
interactive verification. This supersedes the former single-pane/default combined
trace layout and the earlier notes describing no combine/dock controls.

## Trace-only scale settings — 2026-11-17

Removed the Pane 1/local voltage-scale header and pane scale state. Scale changes
now live solely in each trace's properties popup; unset trace scales use automatic
scaling. The trace settings gear appears on legend-row hover or keyboard focus,
and stays visible on devices without hover. The plot uses the freed header height.
This supersedes the retained local-scale control in the earlier notes below.

## Scope simplification requested by user — 2026-11-17

Removed the per-pane Latest/Cursor readings footer, the general Component updated
status strip, and the scope toolbar containing time/div, Add pane, layout dropdown,
acquisition info and duplicate Pause/Run controls. Removed unused toolbar state
and reclaimed footer height for the plot. Scope toggle, trace/run status, Clear,
local voltage scale, plots and trace legends/properties remain. Main app simulation
controls still operate the solver; the scope keeps its default 2 ms time window.
Simulation errors use the remaining scope status text. This supersedes the earlier
interface notes below; do not restore removed controls without a user request.

## Scope interface and measurements follow-up — 2026-11-17

The user wants a substantial scope interface cleanup. A first pass extracts the
plot/legend into `wires/src/editor/ScopePane.tsx` and formatting/statistics into
`scopeDisplay.ts`, making further UI work independent of the editor shell.
All panes now have the same local voltage-scale header; the special global Pane 1
voltage control is removed. Acquisition diagnostics are collapsed by default.
The legend shows cursor/latest value, each trace's actual scale, manual/auto state,
offset and AC state, plus visible-window RMS and peak-to-peak. Properties adds
mean, RMS, peak-to-peak, min and max with explicit raw-sample semantics. The footer
keeps time and same-unit two-trace difference rather than repeating every reading.

The vertical axis uses V or A only when visible traces share one DC scale/offset;
otherwise it shows divisions and the legend supplies each trace's physical scale.
AC autoscaling uses mean-removed bounds. Horizontal grid lines are placed at ten
equal time divisions instead of fixed pixel spacing, fixing resize-dependent
time/div interpretation. These updates supersede the mixed-axis/measurement
limitations in the earlier scope slice below. Frequency estimation, trigger,
workspace persistence and imported-settings validation remain open. The broader
visual redesign is still iterative; this pass does not establish final UI parity.

`pnpm --dir wires build` passed with the existing chunk-size warning. No browser
checks or tests were run for this follow-up, following the handoff constraints.

## Scope current traces and trace properties — 2026-11-17

Component context menu → Add to scope now includes Current through component for
models with a non-null native current mapping. Voltage-across and pin-to-ground
actions remain available. Current probes target stable component IDs. The adapter
samples signed component current on every solver step, using the existing mapping
sign rather than inferring direction from the displayed pin order. Mixed voltage
and current batches share timestamps and the 32-channel limit. Invalid current
targets are rejected before advancing the solver.

Each scope legend row has a settings button opening Trace properties: name,
CSS colour, optional manual scale in V/div or A/div, vertical position in divisions,
AC/DC coupling and Delete trace. Settings live on the document probe and use
undoable transactions; they travel with saved circuit JSON. Presentation changes
do not change the sample descriptor signature. Current channels have independent
automatic scaling and amp readings. AC currently subtracts the visible window's
mean for display; it is not a stateful high-pass filter. Readouts/min/max still use
raw samples. Pane visibility, layout, time/div and pane scale remain UI state.

This is a first slice of original Falstad scope functionality, not full parity.
The plot axis is still labelled in volts even for mixed/current-only panes, and
manual trace scale/offset overrides are not fully represented in the axis/legend.
Colour is currently a text field accepting CSS colours. Trace settings need strict
validation on document import. Triggering, FFT, broader derived measurements and
scope workspace persistence are not implemented in React.

## Meter symbols and live sheet readings — 2026-11-17

The user resized the ammeter to native sheet units: pins a/b at ±100, circular
body radius 50, 64-unit A text, and upright +/− markers at x=±80, y=−30 with
36-unit text. Preserve that authored design. Voltmeter and ohmmeter now match it,
including polarity marks. Wattmeter retains four terminals at x=±100, y=±50,
with a 100×160 rectangular body and matching text size; it has no new polarity
markers. Their metadata has no legacy drawingScale; regenerate the catalog from
TSX rather than hand-editing generated pins.

Ammeter, voltmeter, ohmmeter, wattmeter and test point display live measurements
above their symbols by default, using the existing upright sheet-label placement.
Explicit user label position/value-visibility settings still apply. Readings include
engineering units, RMS/average and voltage max/min/peak-to-peak suffixes where
applicable, binary mode and open-circuit resistance. Before a measurement arrives,
they show an em dash. Test point artwork/pins were not resized in this slice.
Existing saved wire/junction coordinates are not migrated when symbol pin geometry
changes; check older circuits for detached-looking endpoints.

### Verification of these slices

Production build and TypeScript passed; the existing Vite chunk-size warning
remains. Symbol authoring checks passed for generated metadata, lead endpoints,
rotations and reflections. Scope sampling/model/continuity checks passed, including
mixed batches, signed source current and invalid-current-target rejection. The
sampling fixture was updated to choose a wire from the normalized document rather
than use an outdated hard-coded coordinate/count. Headless React rendering and
focused meter formatting checks passed. No browser interaction/visual verification
was performed. ESLint reported four existing editor issues (effect state updates,
an explicit any, and ref use); unrelated existing symbol whitespace also remains.
These results describe the checks performed in this chat, not full UI certification.

## Recommended next slice — scope scaling and measurements

1. First pass implemented above; refine units/scales for current-only and mixed V/A panes, including
   per-trace manual scale and offset. Keep engineering-unit labels consistent with
   what the plotted divisions actually mean.
2. Mean/RMS/peak-to-peak are now implemented above; next add frequency for suitable
   periodic signals, with explicit treatment of AC coupling and visible-window
   statistics. Expose them through the existing properties dialog.
3. Validate persisted trace settings and add document round-trip coverage, then
   save scope pane assignments/visibility, layout and time/div. Decide what belongs
   to circuit JSON versus a local workspace before implementing that persistence.
4. Add trigger mode/edge/level for stable periodic waveform inspection. FFT and
   specialised Falstad plots can follow as separate parity slices.

Keep simulation-time slider automation as the next larger new tool in PLAN.md;
apply ramps at worker step boundaries rather than driving full document edits
from browser timers. Do not begin it as part of a documentation-only task.


## Saved scope workspace — 2026-11-17

Scope layout now lives in optional `layout.scopes` (version 1) in circuit JSON,
alongside the existing per-probe trace settings. Save/Open and autosave retain
combined trace assignments, selected axes, each pane's time scale, docking mode,
split weights, bottom-panel height/open state, and undocked positions/sizes and
sheet reference zoom. Older circuits without this field use defaults.

`scopeLayout.ts` keeps drag previews local and commits on pointer release; layout
changes use one undoable document transaction rather than saving every move.
External Open/Undo/Redo restores workspace state. The longest saved pane time scale
restores acquisition's display window. Core document validation checks workspace
shape, finite geometry/scales and optional trace settings. Dormant group mappings
are retained so probe deletion/Undo can restore the layout. Camera movement stays
outside circuit state and does not trigger saving or history entries.

The user explicitly requested minimal-credit continuation with no browser
verification. Only TypeScript/build checks were used; interactive save/open and
Undo flows remain unverified in a browser.


## Snapshot before maintenance cleanup — 2026-11-17

Historical snapshot; current instructions live in HANDOFF.md.

# New simulator: current handoff

Updated 2026-11-17. Read this and [PLAN.md](PLAN.md) first.
[HANDOFF-HISTORY.md](HANDOFF-HISTORY.md) preserves earlier implementation notes,
checks and limitations. Its old “latest” headings, continuation prompts and
batch-specific verification restrictions are not current instructions.

## Editor cleanup — 2026-11-17

The intermediate JavaScript editor (`editor.js`, `editor.html`, `editor.css` and
`scope-view.js`) has been removed at the user's request. React in `wires/` is the
active new editor; its separate Vite `/editor.html` preview remains. This cutover
does not certify full Falstad compatibility or complete browser parity.

- `packages/circuit-runtime`: low-level, document and revision worker entry points;
  the React worker calls the core modules directly without prototype adapters.
- `wires/src/editor/menu`: generated Falstad menu hierarchy and availability map;
  `tools/generate_component_menu.py` writes here.
- `tools/engine-harness`: retained engine verification pages, traces, regression
  helpers and compatibility adapters for existing tests. No React dependencies.
- `makeEngineSite` and the cached fallback assemble runtime plus harness, clearing
  stale output. Vite packages runtime/core/compiled engine only.
- Prototype DOM-specific editor/drag/loose-end browser runners and the verifier's
  `--editor`/`--screenshot` modes are retired. Core/model/numerical tests remain.

The original Falstad Java/GWT interface remains available through `makeSite` as a
development reference and existing deployment. Earlier sections describing the
intermediate editor as a live reference are historical and superseded by this
cleanup. Recover its source from Git history if needed; do not restore it as a
runtime dependency. Existing React, symbol, core and Java work was preserved.

See [UPSTREAM-ARCHITECTURE.md](UPSTREAM-ARCHITECTURE.md) for the dated source audit,
repository options and proposed upstream update checks. A clean upstream checkout
plus a small patch layer remains a proposal; no repository/submodule conversion
was performed. Next establish the engine boundary and import/compatibility
fixtures while preserving the current app.

### Cleanup verification

The React production build (84-symbol metadata check, TypeScript and both Vite
entries), SSR divider render, packaged worker divider/RC checks, menu hierarchy,
document adapter and revision/coordinator checks passed after relocation. The
build retains its existing large-chunk warning. `test_editor_model.mjs` still
fails at `200 !== 192`, and `test_core_package.mjs` at `84 !== 65`; both failures
were reproduced from the pre-cleanup source snapshot. They are not new passing
checks or cleanup regressions. No browser interaction checks were run.

A fresh Java/GWT engine and worker compilation plus harness assembly passed using
the cached fallback with
`JAVA_TOOL_OPTIONS=-Dgwt.jjs.permutationWorkerFactory=com.google.gwt.dev.ThreadedPermutationWorkerFactory`.
Default Gradle and external permutation workers could not bind local sockets in
this sandbox. `build/engine-site` was freshly assembled without the retired UI.
The Gradle `Sync` assembly change was inspected but could not be executed here.

A pre-cleanup copy of modified/untracked files and a binary Git diff were saved
outside the repo in the local temporary directory (`circuitjs-editor-cleanup-*`).
134 pre-existing implementation files were checked byte-for-byte; the exceptions
are the React menu import, simulation-cadence comment and test adapter paths.
The Java sources and shared core implementation were not changed by cleanup.

## User goal and implementation contract

The goal is to **bring the full bundled original Falstad functionality into the React/TypeScript app in
`wires/`, preserving the old app's behavior and interaction details while making
the presentation easier for the user to style**. This means a real React/SVG
implementation of the editor, menus, dialogs, property forms, scope and simulation
controls. Do not embed the old app in an iframe, redesign interactions, or stop at
the current prototype slice. Use the retained core fixtures and original Falstad app as behavior references;
the intermediate editor has been retired.

The agreed stack is React/TypeScript in `wires/`, shadcn/component libraries for
the shell, SVG for the sheet, and the existing JavaScript core plus CircuitJS
worker/solver. Styling should remain separable from behavior through React
components, semantic classes and tokens; do not port the old stylesheet wholesale.
The user chose one authored TSX file per symbol, co-locating symbol metadata and
its React SVG view. Generate plain-data catalog sections for the headless
core/worker; never add React/TSX to their runtime or duplicate handwritten pin
geometry.

## Full-app migration plan and current priority

Keep the feature-by-feature parity inventory using the retained fixtures, original
Falstad app and historical JavaScript editor behavior recorded in Git history. For each feature, identify the old behavior and
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
now better, and later reported much more responsive pan/zoom after scope caching.

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
now maps these to exact voltage `{id, positive, negative}` terminal descriptors
or current `{id, kind: "current", componentId}` descriptors. Presentation fields
must stay outside the strict worker descriptors. Do
not reintroduce temporary dynamic-import diagnostics in `wires/index.html`.

## Current scope and meter checkpoint — 2026-11-17

This section supersedes the earlier scope UI iterations archived in
[HANDOFF-HISTORY.md](HANDOFF-HISTORY.md). Treat the user's simplified interface as
the current contract; do not restore removed toolbars or side legends.

- **Acquisition:** signed voltage/current channels sampled at every solver step,
  up to 32 channels; 10 steps / 16 ms coordinator cadence remains unchanged.
  Every new probe gets its own scope, with combine/separate available.
- **Ownership:** pane owns time/div; each trace owns independent automatic/manual
  V/div or A/div, vertical position, colour, name and coupling. Click its name or
  waveform to select the vertical axis, which follows that trace's colour, units,
  scale and offset. AC subtracts the visible mean for drawing; statistics stay raw.
- **Presentation:** full-width plot, vertically stacked trace names at bottom-left,
  larger discoverable trace-properties gears. Top-right annotations are ordered
  cursor value → time scale → vertical scale. Trace properties has colour swatches,
  automatic/manual scale, position/coupling and collapsed mean/RMS/peak-to-peak/
  min/max measurements. No status strip, acquisition info, side legend, pane scale
  row, standalone time selector, Add pane/layout dropdown or duplicate Pause button.
- **Pane menu:** right-click for Time scale, named trace submenus (vertical scale,
  position and axis selection), combine/separate, dock/undock, placement mode,
  row/column dock presets and Delete scope.
- **Docking:** nested horizontal/vertical splits support mixed layouts, e.g. one
  pane left and two stacked right. Drag grips to pane edges to split, drag out to
  undock, or drag back to dock. Both divider orientations resize. The whole bottom
  panel is capped at 50% of viewport height; larger layouts scroll internally.
- **Undocked modes:** floating panels stay in pixels, with sliders' 12px margins /
  48px toolbar clearance, and snap to edges/other floating scopes/sliders with 12px
  spacing. Sheet scopes snap position and size to the 50-unit world grid, scale
  with symbols and retain initial appearance on placement. Both move/resize by
  their grips/corners. Wheel/trackpad, middle-drag, Space+drag and pan-tool navigation
  work over sheet scopes. Hiding the dock leaves undocked scopes visible.
- **Selection/deletion:** select a scope, then Backspace/Delete or its menu removes
  that scope's probes in one undoable operation; electrical components remain.
- **Cursor contract (latest user choice):** hovering holds a fixed plot position and
  reads new samples as simulation advances. Click-and-hold latches one exact sample,
  which moves across the plot; release resumes hover sampling. All panes use the
  identical sample timestamp regardless of time scale. A pane hides the cursor
  when that sample falls outside its visible sample window. Cursor value reports
  the selected trace's raw value at that sample. Pointer state is transient.
- **Persistence:** optional version-1 `layout.scopes` saves combined assignments,
  selected axes, pane time scales/modes/geometry, sheet reference zoom, dock split
  tree/ratios/order and bottom height/open state. Per-probe metadata saves trace
  settings. Save/Open/autosave and Undo/Redo use the document model. Drag previews
  remain local and commit on release; camera updates do not enter circuit history.
  Older circuits without workspace metadata retain defaults; old row-only layouts
  convert to a horizontal dock. Core validation checks the saved representation.

### Performance and verification

Camera publication uses `scopeViewport.ts` rather than editor-shell state. Scope
windows/grouping and plot content are memoized; pan/zoom only repositions sheet
scopes, offscreen sheet plots skip drawing, and DOM panel-snap targets are measured
at gesture boundaries/resize. The user reported navigation was “MILES better” after
this change; this is user feedback, not a measured performance benchmark.

Latest production build and TypeScript passed, with the existing Vite chunk-size
warning. Early scope sampling/model/continuity and symbol/meter headless checks
passed before later UI changes; they do not certify the latest drag/persistence/
cursor behavior. No browser verification has been performed for this scope work.
The user explicitly requests minimal credit use and no browser verification. Use
focused build/type checks; do not launch browser checks or broader tests unless
requested. Earlier ESLint issues remain outside this scope.

### Meter design

The authored ammeter uses a radius-50 body, pins at ±100 sheet units, 64-unit A text
and upright 36-unit +/− marks at x=±80, y=−30. Voltmeter and ohmmeter match it;
wattmeter keeps four pins at x=±100, y=±50 and a 100×160 body. All four plus test
points show live readings above by default, respecting label overrides. Meter modes
include RMS/average, voltage extrema/peak-to-peak/binary and open resistance. Test
point artwork was not resized. Old saved wire coordinates are not automatically
migrated after pin changes; regenerate catalog metadata from the authored TSX.

### Source map

`ScopeWorkspace.tsx` owns grouping, interactions and docking; `scopeDock.ts` owns
split-tree operations; `ScopePane.tsx` draws traces/axes/labels; `ScopeContextMenu.tsx`
and `TraceProperties.tsx` own settings. `scopeDisplay.ts` shares sample windows,
statistics and vertical mappings; `scopeLayout.ts` stages/synchronizes saved layout;
`scopeViewport.ts` isolates camera updates. `core.ts` types optional workspace data;
`packages/circuit-core/document.js` validates it. Preserve this separation and the
sampling/worker boundary when adding features.

## Current next work — full Falstad parity first

**Current priority: full functionality of the bundled original Falstad app before
new custom tools.** Parity with the JavaScript prototype alone is insufficient;
use the original Java/GWT menus, dialogs, element models, file formats and bundled
examples as the full specification. Keep the user's React styling and accepted
scope interactions; functional parity does not require restoring rejected UI.

1. **Legacy circuit compatibility and examples:** import/export native circuit
   text, including flags, models, connectivity and scope settings; expose bundled
   examples. Start with supported records and explicit unsupported diagnostics,
   never silently omit elements. Track loadability separately from type coverage.
2. **Complete models and variants:** use LEGACY-CATALOG.md/JSON to close the actual
   menu/example coverage gaps, prioritising commonly used missing models such as
   the 555 timer and relay, then remaining building blocks, chips and variants.
3. **Original scope/measurement functions:** finish trigger, frequency/period,
   spectrum/FFT, XY and other native measurements/plots, retaining the simplified
   React presentation and existing exact-time cursor/layout behavior.
4. **Remaining native workflows:** inventory and complete missing commands,
   component/model options, simulation controls, recording/audio and import/export
   actions against the original app, not just the prototype.
5. **Acceptance/cutover:** compare supported numerical behavior, saved examples and
   representative workflows; keep the reference until the user accepts parity.
   Continue the low-credit/no-browser-check constraint unless the user changes it.

The first concrete slice should be legacy text import for already-supported
components with clear unsupported-record reporting, followed by bundled-example
loading. This makes remaining coverage gaps visible using real Falstad circuits.
Do not claim all 374 bundled circuit files are loadable from the current 84-model
inventory. See LEGACY-CATALOG.md for the static inventory and its limitations.

Slider automation, looping modulation, parameter sweeps and Bode tools are deferred
until native Falstad functionality is complete or the user explicitly reprioritises.

## Slider list removal and ordering — 2026-11-17

Property controls and built-in pot/voltage controls now render in one keyed
`SliderList`, rather than a separate array of property controls beside the
reorderable list. Property rows use namespaced stable IDs, reuse the same grip,
drop indicators, edge scrolling, keyboard movement and saved ordering, and retain
their edit/remove buttons. Removal updates the latest configuration through a
functional state update and cancels any active preview. Removed rows are excluded
from the list immediately; the empty-state message appears when no controls remain.
The former separate property-row component/state was removed. Build passed with
the existing chunk-size warning; the reported deletion symptom and mixed-list
pointer behavior have not been browser-verified under the current constraints.

## Slider preview pacing — 2026-11-17

React slider previews now coalesce to the latest value, render the sheet preview
at animation-frame cadence, and send at most 30 solver updates/second with one
update in flight. They wait until the coordinator is idle before changing its
desired revision: the previous implementation could invalidate an in-flight
step, losing its sample batch. Release still commits the exact final value as one
undoable edit; cancellation restores the committed document. The coordinator's
10-step/16-ms pacing and revision guards remain unchanged.

`useCircuitSession` appends every accepted sample batch immediately but batches
scope-window construction and React state publication to animation frames. Scope
trace/envelope calculations and the document's channel inventory are memoized so
slider-only renders do not rebuild unchanged traces. The previews still compile
and submit full document updates; general component edits can still incur solver
analysis costs. No measured browser performance claim: build passed with the
existing Vite size warning; browser checks/tests were not run under the current
verification constraints.

For future automation, introduce validated control events/ramps on simulation
time in the worker, applied at solver step boundaries, rather than scheduling
full document edits from browser timers. Interpolation policy and safe fast paths
for each parameter need explicit design; that automation API is not implemented.

## Item context menus and property sliders — 2026-11-17

Right-clicking a sheet item opens a shadcn menu at the pointer. It selects the
clicked item unless it is already in the current selection, preserving group
operations. Edit (components/probes), connected drag, detached move, rotation,
flips, copy/cut/duplicate and delete reuse the existing commands. Sheet shortcuts
are suppressed while the menu is open. Existing clipboard limits still apply:
probes are copied with their selected electrical anchors, not independently.

Components offer Add property slider: choose any numeric parameter (including
nested waveform fields), label, minimum, maximum and step. Controls appear in the
existing Sliders panel, preview via the coordinator, and commit one validated,
undoable transaction on release. Remove controls with their × buttons. Configs
are retained locally per circuit ID for the main app; they are not part of saved
circuit JSON. The existing voltage/wiper sliders and their ordering are retained.
Nonnumeric properties remain in Edit. Each property control has a pencil button to edit its property, label, minimum,
maximum and step in a prefilled dialog. Save replaces the configuration in place
and retains its ID/order; Cancel discards changes. Configuration edits do not
change the component value. All controls share the same list: drag their grips or use Up/Down on a grip
to reorder property sliders alongside pots and variable voltages. Mixed ordering
is remembered locally per circuit, retaining existing built-in slider order.

Add to scope offers differential voltage across the first two catalog pins and
individual pin voltage to ground. Wires/junctions offer voltage-to-ground probing;
existing probes offer Show in scope. These actions open the scope. Current traces
were added in the later scope slice documented above. Build/TypeScript checks passed with the existing
Vite size warning. Browser interaction verification remains pending.

## Selection and Add menu — 2026-11-17

Selected symbols now use their color/stroke highlight without the dotted bounding
rectangle. A opens the Add menu at the last sheet pointer position (sheet center
before any pointer activity); clicking Add still anchors it to the menubar.
Component searches show matching leaves in a flat list, including descendants
when a category name matches. Empty search retains the category hierarchy.
`pnpm --dir wires build` passed with the existing chunk-size warning. Browser
interaction checks were not run, per the current verification constraints.

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
the original Falstad build available as a development reference. See the plan
above for the remaining migration groups and acceptance direction.

The cached Java/GWT build worked with the installed Corretto 8 JDK. This sandbox
required in-process compilation:

```sh
JAVA_TOOL_OPTIONS='-Dgwt.jjs.permutationWorkerFactory=com.google.gwt.dev.ThreadedPermutationWorkerFactory' \
  python3 tools/build_engine_cached.py \
  --java-home /Library/Java/JavaVirtualMachines/amazon-corretto-8.jdk/Contents/Home
pnpm --dir wires dev
```

Next: begin the native Falstad compatibility/parity work above; custom slider
automation and analysis tools are deferred. Preserve the accepted scope contract.
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
- `packages/circuit-runtime/`: dedicated-worker entry points.
- `wires/src/editor/menu/`: generated hierarchy and placement availability.
- `tools/engine-harness/`: development verification pages and compatibility
  adapters used by retained regression tests; no application frontend.
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

Historical Chrome checks exercised the retired prototype's pointer/keyboard
workflows. Its three DOM-specific runners have now been removed; those results do
not establish React browser parity. The computational entry command remains
`node tools/check_core.mjs`. Browser verification of the retained engine harness
remains available through `tools/verify_engine.py` when requested.

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

This server hosts the engine verification harness, not the React editor.
Run `pnpm --dir wires dev` and use its printed URL for the application. No server is guaranteed to be
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

1. [PLAN.md](PLAN.md) and [UPSTREAM-ARCHITECTURE.md](UPSTREAM-ARCHITECTURE.md): current priorities, upstream audit and proposed maintenance architecture.
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
performance, broad browser/platform coverage, full workspace portability and desktop packaging remain open. Scope layout is
now saved with the circuit. The shared-core extraction is implemented;
the latest priority is the cleanup/upstream-maintenance discussion near the top,
followed by continued compatibility work.
The existing behavior tests and simulator remain the reference throughout.
