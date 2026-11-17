# Phase 0: editor-independent simulation

> Cleanup note (2026-11-17): the intermediate JavaScript editor has been retired.
> Old `experiments/engine` paths and prototype browser commands below describe the
> historical implementation. Runtime workers now live in `packages/circuit-runtime`,
> verification assets in `tools/engine-harness`, and the active editor in `wires/`.
> See [HANDOFF.md](HANDOFF.md) for current build and verification status.

Updated: 2026-11-13. Result: browser and dedicated-worker prototypes, including
RLC, nonlinear diode rectification, and timed switch events. Full engine extraction
and frontend selection remain open.

## Implementation

`EngineEntryPoint` starts a minimal CirSim host and the existing SimulationManager.
It does not call CirSim.init() or construct UIManager, MouseManager, ScopeManager,
JSInterface, menus, or a drawing canvas. The application timer is never scheduled.
A separate GWT module exports `window.CircuitEngine`.

The worker variant exports the same engine inside a real DedicatedWorkerGlobalScope.
It has no window/document shims. EngineWorkerLinker emits a single computation
permutation directly, bypassing GWT's DOM loader and document-mode checks.
CircuitElm.initSimulationClass separates model setup from UI preferences/fonts.
The normal editor retains its original UI initialization.

The existing analysis, stamping, solver selection and electrical models remain in
use. A bounded path through the same stepping loop replaces UI/wall-clock pacing.
The normal editor still uses its paced path. No equations or solvers were rewritten.

## Reproduce

Requirements: Java 8 JDK, Gradle 8.7 via the wrapper, Python 3.9+, Node 22+ (built-in
WebSocket), and Chrome or Chromium. Verified with Node 26 and Chrome on macOS.
Set JAVA_HOME to your JDK as needed. Initial builds download dependencies.

```sh
./gradlew makeEngineSite --console plain
python3 tools/verify_engine.py
```

The verifier starts a loopback server and temporary headless Chrome profile and
exits nonzero on failure. Use `--chrome /path/to/chrome` to override the browser.
Add `--output /tmp/engine-results.json` for full results. Committed numerical
references mean the original app build is not required for routine verification.
The browser runner uses real time through CDP. Chrome's virtual-time fast forwarding
can expire request timers before worker replies arrive, so it is not used here.

For manual use:

```sh
python3 -m http.server 8000 --directory build/engine-site
```

Open http://localhost:8000/ for a divider example, or `/verify.html` for checks.
The engine build is opt-in; it is not added to the normal deployed site.

## API

Wait for `window.oncircuitengineready(engine)` before using:

```js
CircuitEngine.load(`v 0 0 0 64 0 0 40 5 0 0 0.5
r 0 64 64 64 0 1000
c 64 64 64 0 2 0.000001 0 0
w 64 0 0 0 0
g 0 0 0 -32 0`, 0.00001);
const results = CircuitEngine.step(100);
CircuitEngine.snapshot();
CircuitEngine.reset();
```

Snapshots contain time, timestep, error, editorFree and element currents/pin
voltages in detached arrays. Element IDs are load-order indices, not persistent
document IDs. Current signs follow CircuitJS conventions. Step count must be an
integer from 1 to 10000. Reset reloads the original text, including stored state.

Input supports `r`, `c`, linear `l`, default-model `d`, non-momentary SPST `s`, DC/sine
`v`, `w` and modern `g` text records. Only flags 0 and capacitor/inductor backward-Euler
flag 2 are accepted. Capacitors require capacitance, stored voltage and initial
voltage. Inductors require inductance, stored current, initial current and saturation
current (must be zero). Switches require position 0/1 and `false` for momentary.
Diodes use no optional parameters. Voltage sources require the six legacy waveform
fields, with waveform 0 or 1. Headers, XML, scopes, unknown models,
other flags and additional optional fields are rejected. Connectivity still comes
from endpoint coordinates. This is not a general CircuitJS file importer.

`CircuitEngine.setSwitch(id, closed)` reanalyzes/restamps the topology without
resetting simulation time or stored component state. It supports only these simple
unlabelled switches. Input events occur between step calls, after the specified
number of completed steps.

For asynchronous worker execution, load `worker-client.js` and use:

```js
const engine = createCircuitWorker();
const environment = await engine.ready;
await engine.load(circuitText, 0.00001);
const results = await engine.step(1000);
await engine.setSwitch(switchID, false);
await engine.reset();
engine.terminate();
```

Each worker owns one session; calls use numbered request/reply messages, in order.
Errors reject promises. Startup/request deadlines terminate a stuck session rather
than allow a timed-out mutation to complete unnoticed. Termination is immediate,
not a save operation. Bounded step calls are synchronous inside the worker; pause
or edits cannot interrupt a step already running. Use small batches for interaction.

## Verification evidence

- Built unchanged app at `c2cd5dc2` using Azul Zulu OpenJDK 1.8.0_512 (Apple silicon)
  and Gradle 8.7; saved its site before editing source.
- Built new engine and modified normal app successfully.
- Divider: checked 2.5 V and 2.5 mA analytic results for 5 V and two 1 kΩ resistors.
- RC: checked backward-Euler discrete recurrence within 1e-10 V, and continuous
  solution within 0.01 V for 1 kΩ, 1 µF and a 10 µs timestep.
- Divider, backward-Euler RC, trapezoidal RC: every pin voltage and element current
  matched the unchanged editor within absolute tolerance 1e-12 at steps 1, 10,
  100, 500 and 1000. Saved values: experiments/engine/reference.json.
- Checked no editor managers/widgets, exact steps, finite results, deterministic
  reset across chunk sizes, detached snapshots, rejected invalid inputs, and
  session preservation on validation errors.
- Also compared with the rebuilt modified editor, exercising its normal paced loop.
- Extended references captured from the unchanged build for an underdamped RLC,
  200 Hz half-wave diode rectifier, and RC switch opening after step 100 and closing
  after step 500. Every sampled pin/current matches within absolute tolerance 1e-12.
- RLC checked against the continuous damped response within 0.1 V at this timestep;
  rectifier checked for forward conduction/reverse blocking; switched RC checked
  against its piecewise backward-Euler recurrence within 1e-9 V.
- All six fixtures match both saved references and main-thread results inside the
  real worker, including reset/replay and switch events.
- Worker operation errors recover, simultaneous workers retain independent state,
  and a main-thread heartbeat continues while 100000 nonlinear steps are requested.
  This is a scheduling smoke check, not a UI frame-rate or throughput benchmark.

The editor can defer wire-current calculation until frame completion. Reference
capture pauses at each target step and samples after that frame; reading currents
inside the timestep callback can observe stale wire values.

Optional comparison against another built site:

```sh
python3 tools/verify_engine.py --baseline /path/to/saved/site
```

`--capture --baseline ... --output /tmp/reference-capture.json` records live
reference traces without replacing committed values automatically. Capture uses
the old public API for sampling and dispatches actual canvas mouse events for the
switch fixture. Its test-only position-field inspection depends on a PRETTY GWT
reference build; it asserts the expected state before/after every UI toggle.

The initial baseline was saved to `/tmp/circuitjs-phase0-baseline`. That and the
temporary JDK/Gradle cache are machine-local; use committed references at home.

## Remaining boundaries

| Area | Limitation / next work |
| --- | --- |
| Host | Still uses CirSim state/diagnostics; a dedicated engine host is future work. |
| Lifecycle | Static state still allows one session per JS realm; separate workers isolate sessions (tested). |
| Browser | Dedicated worker proven in Chrome; other browsers, Node runtime and CSP-sensitive deployment remain unverified. |
| Geometry | Models still include drawing/editing code; the separate document adapter now supplies explicit connectivity. |
| Models | Default diode covered; adaptive timestep, saturation, large sparse, custom diode, composite, digital and audio behaviour remain unverified. |
| Scheduling | Requests are ordered and bounded; continuous scheduling exists in the coordinator. No interruption inside a batch or adaptive pacing yet. |
| API | Stable IDs/revisions and replacement for parameter/topology edits exist in the separate document API. Broader live edits and richer diagnostics remain open. |

Preserve the existing source notices and license terms as packaging decisions are
made. The checks protect the tested behaviours, not full compatibility or physical
accuracy of every model.

The stable-ID document loading slice now exists separately; see
[DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md). Revision/run-epoch coordination and safe
replacement/reset are also implemented; see [COORDINATOR.md](COORDINATOR.md).
Continuous scheduling and RC live edits are implemented in
[RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md). The first editor and its KiCad-like
contact/drag behaviour are in [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md).
