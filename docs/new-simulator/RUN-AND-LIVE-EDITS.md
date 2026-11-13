# Continuous run/pause and live RC switches

Implemented, 2026-11-13. The coordinator continuously requests bounded batches
and applies supported SPST switch changes between steps without resetting time or
capacitor charge. Existing CircuitJS model equations remain unchanged.

## Run and verify

```sh
node tools/test_document_adapter.mjs
node tools/test_simulation_coordinator.mjs
node tools/test_continuous_simulation.mjs
./gradlew makeEngineSite --console plain
python3 tools/verify_engine.py
python3 -m http.server 8000 --directory build/engine-site
```

Open http://localhost:8000/continuous.html for Run/Pause/Step/Switch/Reset controls
and a small recent-voltage plot. This is a technical demo, not the new circuit editor.
It loads the saved examples/switched-rc.json, copied from the repository example.
Requirements remain Java 8, Gradle wrapper, Node 22+, Python and Chrome.

## API

```js
const simulation = CircuitSimulation.create({
  batchSteps: 128, intervalMs: 16,
  onFrame(frame) { /* accepted stable-ID results */ },
  onState(state) { /* clear live overlays when state.frame is null */ }
});
await simulation.setDocument(switchedRCDocument);
simulation.run();
await simulation.setSwitch('s1', false); // open at next step boundary
await simulation.pause();              // no more automatic steps after acknowledgement
await simulation.step(10);             // explicit stepping while paused
simulation.run();                      // resume same worker/run/state
await simulation.reset();              // fresh paused run of latest desired circuit
simulation.dispose();
```

run() starts scheduling and returns state immediately; it is not a promise for an
infinite simulation. Batch size is fixed per coordinator, from 1 to 10000 steps;
intervalMs is a nonnegative delay between batches. These are throughput controls,
not a guarantee that simulation time follows wall-clock time. Default is 128 steps
with a 16 ms delay. Only one batch is in flight; no work backlog is queued.

pause() cancels the next timer, enters pausing if a solve is in flight, and waits
for that bounded solve. It does not interrupt a synchronous solver call. Pending
live edits may still complete after pause; pause stops stepping, not committed
electrical mutations. A later run() is an explicit new resume request.

Manual step() is rejected while continuously running. General electrical edits,
reset, invalid documents and simulation failures stop continuous scheduling.
Successful replacement/reset remains paused until run() is requested again.
Disposal cancels timers and workers. Failures are surfaced via state/error instead
of endlessly scheduling failed solves.

## Live-switch semantics

The document catalog now includes version 1 capacitors (a/b pins, positive finite
capacitance, finite initialVoltage, trapezoidal/backwardEuler) and non-momentary
SPST switches (a/b pins, boolean closed), in addition to R/DC source/ground.

A setDocument commit whose only electrical difference is one switch's closed
parameter takes the same live path as setSwitch. It advances documentRevision and
circuitRevision, but keeps sessionId, runEpoch, simulation time and stored state.
Layout changes can accompany that transaction. Other changes, including multiple
switches changed in one document commit, currently use replacement/reset.

Rapid separate switch edits are FIFO, never coalesced. They drain the current
batch, apply before another batch starts, and acknowledge appliedAtTime. Their
targets are desired booleans rather than ambiguous toggle commands. During the
update the old revision is not a live overlay. The next successful step produces
a frame for the accepted new revision; restamping alone produces no solved frame.
Paused switch edits remain pending results until Step/Run computes a frame.

If a replacement supersedes a live request already sent, it drains that request
first. A completed physical mutation is recorded on the retained worker even if
its result is no longer current. Queued unsent live operations are superseded.
If a replacement was already required, subsequent switch values are folded into
the replacement document rather than pretending that its run is preserved.

Reset loads the latest desired switch positions and the document's initial
capacitor voltages. Runtime capacitor charge is never saved back into those
parameters. The worker advertises `setSwitch:rc` and validates the operation again.

## Supported scope

This is a conservative R/C/DC/SPST document family, not a promise of preserving
state in arbitrary CircuitJS circuits. Inductors, diodes and other document models
remain unsupported even though some exist in the text prototype. Floating islands,
ideal source/closed-switch loops, and ideal capacitor/source loops (including
redundant ideal capacitor loops) are rejected before mutation. The legacy engine
would otherwise repair some of these by adding resistance or resetting charge.

Validation failures preserve the engine, show the desired document error and stop
running. Engine/restamp failures fault the run and require reset/replacement; there
is no silent fallback from preserve to reset. The interactive demo breaks plotted
lines at revision changes and clears history at run-epoch boundaries.

## Evidence

Pure tests use controlled task queues/promises for run, queued/in-flight pause,
FIFO edits, mutation priority, replacement drainage, automatic solve/restamp failure,
timer cancellation and disposal. Existing revision/adapter race tests remain.

Real Chrome workers match the unchanged switched-RC reference at every saved sample:
all public pin voltages and component currents within absolute tolerance 1e-12,
with switches opening after step 100 and closing after step 500. Checks also cover
nonzero initial charge, reset with the latest open switch, continuous batches,
no advancement after pause acknowledgement, stateful resume, and a switch edit
requested inside a continuous-run frame callback. Its next batch follows the
expected capacitor discharge recurrence without a session/epoch change.

## Next

Prototype the circuit canvas interactions against this boundary: placement,
selection, explicit wiring and navigation. Adaptive batch timing, a richer waveform
API, broader model capabilities and cross-browser validation can follow measured
needs; no Rust/UI toolkit choice has been made by this implementation.
