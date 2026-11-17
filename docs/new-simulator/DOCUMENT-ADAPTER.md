# Saved-document worker: first implemented slice

Implemented and verified, 2026-11-13. This adds stable component/pin IDs on top of
the existing worker engine. This low-level API is retained; the revision/epoch
protocol and safe editor-facing coordinator now exist separately in
[COORDINATOR.md](COORDINATOR.md).

## Shared implementation — 2026-11-16

The compiler/session implementation now lives in
[packages/circuit-core/adapter.js](../../packages/circuit-core/adapter.js), using the
shared [component catalog](../../packages/circuit-core/catalog.js).
`experiments/engine/document-adapter.js` preserves the old global API as a thin
compatibility adapter. New frontends can import `adapter` from the package ESM
entry without the prototype UI. The saved format, protocol and numerical behavior
are unchanged. See the [core API guide](../../packages/circuit-core/README.md).

## Run it

With the Java 8 / Gradle / Node / Python / Chrome setup in PHASE-0.md:

```sh
node tools/test_document_adapter.mjs
./gradlew makeEngineSite --console plain
python3 tools/verify_engine.py
python3 -m http.server 8000 --directory build/engine-site
```

Open http://localhost:8000/document.html for the saved-divider demonstration, or
`/verify.html` for the combined numerical and document-worker checks. The build
copies the real `docs/new-simulator/examples/voltage-divider.json` into the demo;
there is no separate hand-maintained circuit fixture for this example.

## API currently available

Load `worker-client.js` on a browser page served from the engine-site directory:

```js
const worker = createDocumentWorker();
await worker.ready;
const document = await (await fetch('examples/voltage-divider.json')).json();
const loaded = await worker.loadDocument(document);
const frame = await worker.step(100);
console.log(frame.pinVoltages.r2.a);       // 2.5 volts
console.log(frame.componentCurrents.r1);   // 0.0025 amps
console.log(frame.componentCurrents.v1);   // -0.0025 amps
await worker.snapshot();                  // last completed frame
await worker.reset();                     // latest loaded document, time zero
worker.terminate();
```

Load/reset acknowledges the document ID, timestep, component IDs and net count,
with `frameAvailable: false`. Snapshot before a successful step returns NO_FRAME.
Frames contain documentId, frameSequence, time, timeStep, pinVoltages,
componentCurrents and diagnostics. Frame sequences start at 1 and reset on
load/reset; there are no circuit revisions/run epochs yet. Results contain only
public component/pin IDs, not engine indices, synthetic wires or internal geometry.

Positive current is a to b for a resistor and p to n for a source. The source's
legacy post order and current sign are normalized by the adapter. Ground voltage
is available at pin g, but ground current is deliberately omitted.

The separate Phase 0 `createCircuitWorker` text/index API remains supported. Do not
mix its methods with a document worker. The new wrapper exposes loadDocument,
step, snapshot, reset and terminate; step bounds remain 1–10000 per call.

## Implementation

- `experiments/engine/document-adapter.js`: pure electrical-document validation,
  net derivation, canonical projection, synthetic CircuitJS input and result mapping.
  It also owns the adapter session lifecycle around the existing engine.
- `document-worker.js`: dedicated worker bootstrap and operation routing. Compiles
  and maps inside the worker so its mapping belongs to the actual loaded engine.
- `worker-client.js`: asynchronous document API plus error-code propagation.
- `document.html` / `document-demo.js`: runnable saved-divider example.
- `tools/test_document_adapter.mjs`: graph/compiler and fault-behaviour checks.
- `document-tests.js`: real-browser worker integration checks, invoked by the
  existing verification runner alongside the original six numerical fixtures.

The catalog now supports version 1 resistors, capacitors, DC/periodic sources and one-terminal rails, non-momentary
SPST switches, three-pin op-amps and ground. See RUN-AND-LIVE-EDITS.md for parameter and topology limits
and use the coordinator for state-preserving switch changes.
Electrical parameters/settings are checked rather than silently ignoring unknown
fields. Wire endpoints and unique IDs are validated, all grounds are joined, and
nets are derived from explicit edges. Junction-only routing fragments are omitted
from the solver. Layout, labels and probes are excluded from the electrical
projection; this module does not validate/render those editor-only fields.

The canonical projection and generated engine text are deterministic under array
reordering, layout changes, redundant wire edges and junction splitting that keeps
the same connected pins. Component terminals receive distinct private coordinates,
then connect to net hubs with ordinary wires. The numerical solver and electrical
models were not changed for this slice.

All document ground symbols map to one physical engine ground. Emitting multiple
GroundElm records plus explicit hub connections creates a redundant loop rejected
by legacy wire-current analysis. Aliasing their public g pins avoids that loop
while preserving global-ground semantics and each symbol's stable identity.

## Validation and failures

Explicit ground is required. Floating circuit islands and ideal voltage-source
loops are rejected before loading in this initial catalog, avoiding silent reliance
on the legacy grounding/ideal-source repair rules. Dangling pins in an otherwise
ground-referenced circuit produce UNCONNECTED_PIN warnings and can still simulate.
Unsupported document models return UNSUPPORTED_MODEL even when the text engine
already supports that model; its document adapter still needs implementing/testing.

Pre-load validation errors preserve the existing simulation and mapping. An engine
failure after mutation marks the session faulted and blocks frames/steps until an
explicit valid document reload. There is no rollback or candidate replacement yet.
Timeouts terminate the worker, as in the existing client.

Errors expose a `.code`, initially INVALID_DOCUMENT, UNSUPPORTED_MODEL, NO_DOCUMENT,
NO_FRAME, ENGINE_FAILURE or INVALID_OPERATION, plus a message. Full structured
entity diagnostics and the versioned request contract remain future work.

## Verification

- Saved divider: three nets, 2.5 V output, 2.5 mA resistor currents, -2.5 mA source
  current and power balance, with 1e-12 numerical tolerance.
- Moving/rotating/mirroring every component onto coincident coordinates, changing
  routes and reversing serialized entity order leaves the real worker results equal.
- Explicit reconnection changes the output to 5 V and branch current to 5 mA;
  overlapping layout alone has no effect. Explicitly shorted resistor pins work
  without zero-length synthetic components.
- Multiple ground symbols retain distinct public IDs and share global ground.
- IDs including `__proto__` map safely through worker messages.
- Graph-equivalent junction splitting/redundant edges preserve the canonical input.
- Invalid/dangling references, duplicate IDs, unsupported versions/models/fields,
  invalid values, missing ground and unsupported floating/source loops are rejected.
- Validation failures preserve a previous frame; reset after changing R2 uses the
  latest 2 kΩ value and produces 10/3 V on the next step.
- Compiler checks exercise fault-after-mutation handling with an injected engine
  failure. The existing six real numerical/worker regression fixtures still pass.

## Next slice

Revision/epoch gating and candidate replacement/reset are implemented separately;
see COORDINATOR.md. Continuous run/pause and capacitor/switch support are now
implemented in RUN-AND-LIVE-EDITS.md. The editor prototype now uses this boundary;
see [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md). Pin contact detection commits explicit
edges, including zero-length contact edges; the adapter still ignores display
geometry. The UI language/toolkit remains open.


## Three-pin op-amp slice

`opamp@1` has `minus`, `plus`, `out` pins and exactly `gain`, `minOutput`, `maxOutput`
parameters. Gain must be finite/positive; output limits must be finite/ordered.
The adapter emits the existing `a` element with its explicit-gain flag and maps
its three actual posts to stable pin IDs. Positive reported op-amp current means
current delivered at the output. The output has an implicit ground reference;
the inputs have no artificial conductance and need an external reference/feedback
path. Ideal output/source loops are rejected by the existing preflight policy.

No numerical op-amp equations were ported or changed. Output limits use the legacy
model's convergence behavior, including small saturation overshoot; tests use its
finite-gain equations and a 0.01 V saturation tolerance. The unused legacy GBW
serialization field remains 1 MHz; it does not implement a bandwidth limit.
See `examples/opamp-noninverting.json` and the editor properties for usage.

Placed voltage probes are document annotations, not catalog devices. A marker
stores a positive target and `reference: "ground"`; the editor derives its reading
from accepted component-pin voltages. Probes and label layout stay outside the
canonical electrical projection; adding a junction for a marker is graph-equivalent.


## Sine voltage waveform

`voltageSource@1` also accepts waveform `{kind: "sine", amplitude, frequency, offset}`.
Amplitude is nonnegative peak volts, frequency positive Hz, offset finite volts.
All values and output extrema must remain finite. Unknown/missing waveform fields
are rejected. DC serialization and its canonical projection are unchanged.

The compiler emits the legacy VoltageElm AC waveform (type v, waveform code 1),
frequency, amplitude, offset and zero phase. No per-timestep transport or new solver
model is introduced. Worker capability negotiation includes voltageSource:sine@1.
The existing reset/replacement policy restarts sine phase at zero. Live frequency
or amplitude changes that preserve simulation time/phase are not implemented.


## Periodic waveforms and one-terminal voltage rails

Voltage waveforms additionally support square, triangle, sawtooth and pulse. They
reuse sine's amplitude/frequency/offset fields; square and pulse require dutyCycle
as a finite fraction strictly between 0 and 1. Other waveforms reject that extra
field. Pulse records carry flag 4 so the legacy parser preserves the chosen duty
instead of applying its old fixed pulse width. Source properties expose duty in %.

`voltageRail@1` has exactly one `p` pin and the same waveform object as voltageSource.
It emits RailElm (`R`) rather than inventing a second public terminal/ground wire.
Its implicit ground participates in floating-island and ideal-source-loop preflight,
including when the document contains no explicit ground symbol. Existing voltageSource
DC/sine documents and their canonical projections remain unchanged. Rail current is
positive into p (passive sign), and its only returned pin voltage is p relative to
ground. Both models roundtrip through worker projection revalidation.


## Optional per-step voltage acquisition

createSession.step(count, channels) and the document worker's matching step method
support up to 32 stable terminal-pair channels for the oscilloscope. Descriptor
validation precedes stepping. A single returned sampleBatch holds the per-step
voltage/time arrays plus channel descriptors, alongside the normal final frame.
Omitting channels keeps the existing call/result behavior. This uses the existing
engine step hook internally and changes no numerical equations. See
WORKER-PROTOCOL.md for the request/reply shape and EDITOR-PROTOTYPE.md for the viewer.

## Catalog expansion (2026-11-14)

The editor/document catalog now contains 28 model kinds. Recent additions are
inductor, diode, currentSource, potentiometer, npn, pnp, nmos, pmos, njfet, pjfet,
andGate, nandGate, orGate, norGate, xorGate, inverter, transformer, spdtSwitch,
dpdtSwitch, led and zener, all at modelVersion 1. The preceding smaller-catalog
notes describe earlier milestones; full upstream model/variant parity is not claimed.

For the latest five kinds, parameter/pin contracts are:

| Kind | Public pins in engine post order | Parameters |
| --- | --- | --- |
| transformer | p1, s1, p2, s2 | inductance > 0, ratio > 0, 0 < coupling < 1, integration |
| spdtSwitch | common, a, b | position: 0=A, 1=B, 2=Off |
| dpdtSwitch | common1, a1, b1, common2, a2, b2 | position: 0=A, 1=B |
| led | anode, cathode | forwardVoltage > 0 (at 1 A), maxCurrent > 0 (brightness only) |
| zener | anode, cathode | forwardVoltage > 0 (at 1 A), breakdownVoltage > 0 |

Transformer winding pairs are p1–p2 and s1–s2. The compiler does not use magnetic
coupling as a ground reference. It rejects floating islands, singular/nonfinite
coupling coefficients and ideal switch/source loops. Transformer and DPDT have no
single component-current mapping; all pins retain voltage results. Neither switch
kind is eligible for the existing state-preserving SPST live-edit path.

## Polarized capacitors and controlled switches — 2026-11-16

`polarizedCapacitor@1` uses `positive`/`negative` pins and the ordinary capacitor's
`capacitance`, `initialVoltage` (positive minus negative) and `integration` fields,
plus nonnegative `maxReverseVoltage` (default 1 V). The legacy `209` model stops
when its solved voltage is below the negative of that limit. The limit is a stop
condition, not a breakdown/conduction model. Ideal capacitor/source loops are
rejected as for ordinary capacitors. ESR is not exposed in this slice.

`analogSwitch@1` has `a`/`b`/`control`; `analogSpdtSwitch@1` has
`common`/`a`/`b`/`control`. Both expose positive `onResistance` (default 20 Ω) and
`offResistance` (default 10 GΩ), finite `threshold` (2.5 V), and boolean `inverted`
(false) and `pulldown` (true). Control voltage is relative to global ground and
has zero input current. At or above threshold, the non-inverted SPST conducts and
SPDT selects A; below threshold SPST opens and SPDT selects B. Inversion swaps
these conditions. Control must have an external reference path.

Without pulldowns, the inactive signal path has `offResistance`. With pulldowns,
the inactive path disconnects and each SPST signal terminal / each SPDT throw has
`offResistance` to ground. These are finite-resistance models and do not enter the
ideal-switch-loop union. Public current is legacy a-to-b current for SPST and
common-to-selected-throw current for SPDT; it does not include every pulldown or
inactive-path current. All pin voltages are mapped. No per-terminal current UI.

The compiler emits validated `159`/`160` records with private horizontal geometry
and the actual legacy post order. Existing constructors and electrical equations
are retained. Parameter edits replace/reset the worker; control waveforms switch
the devices naturally during stepping, without a live editor mutation API.

The legacy switch evaluates the previously solved control voltage, so waveform
transitions appear at the signal output one electrical step after the control
voltage changes in the solver. This timing behavior is retained and tested.

## Display markers and logic I/O — 2026-11-16

The catalog now contains 34 model kinds. The three additions use the legacy
single-post display/logic elements:

| Kind | Public pin | Parameters |
| --- | --- | --- |
| output | in | showVoltage (boolean, default true) |
| logicOutput | in | threshold (finite, default 2.5), mode (`logic`/`numeric`/`ternary`), pulldown (boolean) |
| logicInput | out | state (integer), highVoltage, lowVoltage (finite), mode (`logic`/`numeric`/`ternary`) |

`output@1` emits the legacy `O` marker with only the VALUE flag; it has no stamp or
current and does not affect the solved circuit. The legacy scale and fixed-precision
options (`scale`/`FLAG_FIXED`) are not exposed. `logicOutput@1` emits `M` with
TERNARY=1/NUMERIC=2/PULLDOWN=4 and a trailing threshold. It is a passive marker;
only the optional 1 MΩ pulldown participates in the circuit. The element declares
that pulldown as an implicit ground connection, so the legacy path/closure
analysis counts it as a return path for an ideal current source. `logicInput@1` emits
`L` with TERNARY=1/NUMERIC=2 and `state false high low`. It is a ground-referenced
ideal voltage source: logic mode selects low/high, numeric mode uses the same two
levels as 0/1, and ternary mode computes `lo + state*(hi-lo)/2` for state 0/1/2.
The legacy momentary push-button option is not exposed; state edits replace/reset.

Compiler preflight treats `logicInput` like `voltageRail`: it provides an implicit
reference, participates in ideal-source-loop rejection, satisfies the explicit
ground requirement and counts as a return path for ideal current sources. Its
public current sign is `-1` (delivery convention, same as a rail). A lone `O`/`M`
marker is seeded into the floating-island reachability set, so a marker with a
ground symbol is accepted; attached passive islands are still rejected. `logicInput`
is reached through its implicit ground link and needs no special seeding. All three
map one pin, and `O`/`M` have no single component-current mapping. Legacy loader
validation covers both the old optional field counts (O/M 6 or 7, L 8 or 10) and the
emitted 6/7/10-field forms, flag ranges, output scale and state/momentary rules.

`examples/logic-monitor-divider.json` combines all three with a resistive divider
and a driven logic-input load. The build copies it to the preview.

## Base flip-flops — 2026-11-16

The catalog now contains 37 model kinds. The three additions emit the legacy
base chip records:

| Kind | Public pins in engine post order | Parameters | Record |
| --- | --- | --- | --- |
| dFlipFlop | D, Q, Qn, clock | highVoltage > 0, initialState | 155 |
| jkFlipFlop | J, clock, K, Q, Qn | highVoltage > 0, initialState, positiveEdge | 156 |
| tFlipFlop | T, Q, Qn, clock | highVoltage > 0, initialState | 193 |

`initialState` is stored as the legacy trailing Q/Q̄ volt pair (high/low);
`highVoltage` defaults to 5 V and emits ChipElm CUSTOM_VOLTAGE (8192) plus the
leading voltage field when different. `positiveEdge` defaults to false (the
legacy JK negative-edge default); true adds POSITIVE_EDGE (4). SMALL (1) is not
emitted. D-flip-flop set/reset flags, small-chip variants and the remaining chip
families are outside this slice and rejected by the guarded loader.

Q and Q̄ are implicit ground-referenced ideal voltage sources. Preflight seeds
both outputs, rejects shorts between them or to ground and ideal-output loops,
and treats them as return paths/reference reachability for current sources;
they do not satisfy the explicit-ground requirement for an otherwise floating
circuit. Inputs are high-impedance and need an external referenced path. There
is no single component current (`sign: null`). Canonical geometry is
`x 32 x+64 32`; D/T posts are `(x,32),(x+96,32),(x+96,96),(x,64)` and JK posts
are `(x,32),(x,64),(x,96),(x+96,32),(x+96,96)`. The loader validates 8/9-field
forms, allowed flags, finite positive logic voltage, exact horizontal geometry
and complementary Q/Q̄ state.

## Counter, latch/register and adders — 2026-11-16

The document/editor catalog now has 41 models. Added four base legacy chip models:

| Model | Stable pins | Parameters beyond positive `highVoltage` (default 5 V) |
| --- | --- | --- |
| `counter@1` | clock, reset, Q3/Q2/Q1/Q0 | initialValue 0..15 (0); modulus 0..16 (0 = 16); invertReset (true); negativeEdge (false) |
| `latch@1` | I0..I3, O0..O3, load | initialValue 0..15 (0); edgeTriggered (true) |
| `halfAdder@1` | A, B, sum, carry | none |
| `fullAdder@1` | A0..A3, B0..B3, S0..S3, carryIn, carryOut | none |

Counter, latch and full adder have fixed four-bit widths; named bit 0 is the LSB.
Counter supports asynchronous reset and rising/falling clock selection; modulus
zero allows the ordinary four-bit wrap. Up/down and loadable counter variants are
not exposed. Latch load captures on a rising edge in register mode, or follows
inputs while high in transparent mode. Set/reset/output-enable/bus variants are
not exposed. The full adder computes A+B+carryIn with S modulo 16 and carryOut;
half adder exposes XOR and AND. No propagation-delay model is added.

Outputs are implicit grounded ideal voltage sources. The compiler's existing chip
output loop, reference reachability and current-source-return rules cover every
output; inputs remain high-impedance. All pin voltages map to stable IDs and the
ambiguous aggregate chip current is omitted. Parameter edits replace/reset.

Compiler records use legacy 164/168/195/196 with actual MSB-first post geometry
and bit-index ordering; the guarded host permits only these fixed-width variants.
CUSTOM_VOLTAGE=8192 adds logic voltage after the bit-count field (or directly for
half adders); latch STATE=2 and optional NO_EDGE=4, full adder BITS=2, and counter
NEGATIVE_EDGE=8 are encoded separately. State volts are validated as 0/highVoltage.
Counter trailing reset-polarity boolean and modulus are validated before mutation.
The original constructors, stamping and equations are retained.

Chips sample the previously solved inputs at the start of each electrical step.
An active-low counter reset initially sees zero input before its rail is first
solved, so it clears even when the saved initialValue was nonzero. This legacy
startup behavior is retained and tested. Active-high reset allows the saved value
to persist while reset stays low. No startup priming or state-preserving edits are
introduced. Existing flip-flop repeated-clock coverage is now retained in its
regression suite, alongside new counter/load waveform and exhaustive adder checks.

## First missing passive-menu entries — 2026-11-16

The catalog now has 46 models. Added the first five missing Passive Components
entries, in menu order, using existing electrical implementations:

| Model | Pins | Parameters / supported variant |
| --- | --- | --- |
| `pushSwitch@1` | a, b | boolean normallyClosed (false); legacy s record with momentary=true |
| `mbbSwitch@1` | common, a, b | position 0..3: A, both, B, both; legacy 416, no linked groups |
| `tappedTransformer@1` | p1, p2, s1, tap, s2 | inductance 4 H, full secondary/primary ratio 1, coupling .99, integration backwardEuler/trapezoidal |
| `customTransformer@1` | p1a/p1b, p2a/p2b, sa/sb | fixed two primary coils and one secondary; base inductance 4 H, signed nonzero turns1/2/3 (1 each), coupling .999, integration |
| `transmissionLine@1` | leftReturn, rightReturn, left, right | delay .001 s, impedance 75 Ω; lossless legacy 171 |

All pins map to stable IDs. Push-switch current follows a-to-b; the other models
omit a single ambiguous current value. Ideal closed-switch loops are rejected,
including both simultaneous MBB paths. Both transformer models preserve winding
isolation in reference/return-path validation; magnetic coupling does not ground
another winding. Initial winding currents are zero in this slice. Coupling must be
strictly between 0 and 1, with finite coefficients. The tapped model has a centered
secondary tap. Custom transformer winding count/topology is fixed for schema v1;
free description editing, extra coils and shared taps are not exposed yet.
Positive scientific exponents in custom turns are emitted without `+`, because
legacy custom-transformer descriptions use `+` to indicate taps. The guarded host
also rejects that ambiguous raw spelling and unsafe winding/coefficient ranges.

Line returns must both explicitly alias global ground, matching the legacy model's
requirement. Delay is quantized down to a whole number of document timesteps and
must span 1..100000 steps. The private width is 32 and losses are zero; neither is
an exposed property. Delay buffers are reset after installing the new timestep,
preventing the previous circuit's timestep from determining buffer length.

A push press uses a transient copy of the document with its contact inverted;
saved JSON, autosave and undo history retain normallyClosed. Release, cancellation,
focus loss and tool changes return to the saved state. Contact changes currently
use worker replacement/reset, resuming Run when appropriate; charge/time continuity
and exact short-pulse capture are not claimed. This is not the existing live RC
SPST path. Other switch/parameter edits also follow replacement/reset behavior.

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
