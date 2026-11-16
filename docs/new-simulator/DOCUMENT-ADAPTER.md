# Saved-document worker: first implemented slice

Implemented and verified, 2026-11-13. This adds stable component/pin IDs on top of
the existing worker engine. This low-level API is retained; the revision/epoch
protocol and safe editor-facing coordinator now exist separately in
[COORDINATOR.md](COORDINATOR.md).

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
