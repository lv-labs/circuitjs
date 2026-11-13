# Circuit revisions and safe worker replacement

Implemented, 2026-11-13. The numerical engine remains unchanged. The document
catalog now includes R/C/DC sources/SPST switches/ground; see
[RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md) for continuous run/pause and live switching.
The coordinator owns document/circuit
revisions, simulation epochs, result gating and candidate-worker activation.

## Run

```sh
node tools/test_document_adapter.mjs
node tools/test_simulation_coordinator.mjs
./gradlew makeEngineSite --console plain
python3 tools/verify_engine.py
python3 -m http.server 8000 --directory build/engine-site
```

Open http://localhost:8000/coordinator.html for the revision/replacement example.
`/verify.html` runs the combined numerical, document and coordinator browser checks.
Requirements are the same Java 8 / Gradle / Node / Python / Chrome setup as PHASE-0.md.

## Editor-facing API

Load document-adapter.js, revision-client.js and simulation-coordinator.js:

```js
const simulation = CircuitSimulation.create({
  onFrame(frame) { /* display only this accepted, ID-mapped frame */ },
  onState(state) { /* clear live overlay when state.frame is null */ }
});
await simulation.setDocument(savedDocument);
await simulation.step(100);
const state = simulation.getState();
await simulation.setDocument(editedDocument);
await simulation.reset();
simulation.dispose();
```

`setDocument` copies its input as a committed edit. documentRevision advances on
every call. An identical canonical electrical projection (including unchanged
document ID) reuses the active worker, circuitRevision, runEpoch and current frame.
Layout changes during a pending install reuse that pending operation too.

Electrical edits advance the desired circuitRevision immediately. Invalid edits
also reserve a new revision and keep the user's desired document; they do not
create a worker. Undo content goes through setDocument and gets a new revision,
rather than restoring an old counter. Reset keeps circuitRevision and starts a
fresh session/runEpoch for the latest valid desired document.

`getState` returns detached data: status, documentRevision, desired document/revision,
accepted session/document/revision/epoch, live frame, historicalFrame and error.
The live frame is null during replacement, after an invalid edit or after failure.
historicalFrame is the last displayed result and must be presented as historical,
never as a live overlay for the desired circuit.

`step` accepts 1–10000 steps and permits only one block in flight. A second step
while busy is rejected. An old step that completes after a circuit edit/reset
returns null and never reaches onFrame. Layout edits do not invalidate it. The
coordinator also supports continuous bounded batches via run()/pause(); manual
steps are rejected while continuously running.

## Replacement lifecycle

1. Clear the live overlay and drain any in-flight step without requesting more.
2. Create one candidate worker with a unique sessionId and a newly allocated epoch.
3. Initialize its protocol and install the full canonical electrical projection.
4. Revalidate inside the worker, including nets/pin assignments; generate private
   CircuitJS input there and load it using the existing engine.
5. Activate only if the installation succeeded, its identity matches, and the
   desired generation has not been superseded. Then terminate the old worker.

Failed validation/startup/installation leaves the previous worker paused and
retained. It cannot be stepped as the desired circuit while the edit is in error.
Fix/undo the document or reset to install a new valid candidate. There is no silent
rollback of the user's document. Failed resets also leave the old worker paused
and its old results historical; they do not revive a live overlay.

Newer electrical edits terminate obsolete candidates. Older pending replacements
resolve with `{superseded:true}` and cannot activate late. At most one candidate
and one active worker are retained. Worker crashes clear the live frame; explicit
reset or resubmitting a valid document can recover in a new worker. Disposal
terminates both workers and prevents late activation. Observer callbacks run only
after internal operation bookkeeping is registered, including re-entrant edits.

Activation guarantees successful loading/analysis, not successful completion of
every future numerical step. If an already-activated run later fails, it becomes
faulted and requires replacement; the retired old worker is not a rollback engine.
General electrical state migration across resets/replacements remains out of scope.

## Protocol implemented

`revision-worker.js` uses revision-protocol.js, a testable synchronous state machine.
`revision-client.js` supplies the dedicated-worker transport with startup/request
deadlines and no automatic mutation retries. These are separate from the retained
Phase 0 text worker and the first document-worker API.

- Version 1 initialize negotiates models, max steps and `liveChanges: ['setSwitch:rc']`.
- Every request uses sessionId, increasing requestId and accepted base identity.
- Duplicate/older IDs and stale base revisions/epochs are rejected before engine calls.
- installCircuit accepts canonical electrical projection into a fresh worker only;
  the target's positive revision/epoch can start above 1 after replacement.
- step/snapshot results carry protocolVersion, sessionId, documentId,
  circuitRevision, runEpoch and frameSequence alongside stable-ID results.
- Low-level reset requires a higher epoch with the same circuit revision. The
  editor coordinator instead stages reset in a candidate for failure isolation.
- dispose ends the session. setSwitch validates a preserve request, advances the
  circuit revision and retains the epoch for the supported RC document family.
- Errors carry code/message/disposition/diagnostics. Numerical errors fault that
  worker; pre-mutation validation errors leave accepted state unchanged.

For a live frame, the coordinator requires the active session, current document,
desired/accepted circuit revision, active epoch and increasing frame sequence.
Before activation, pending replacements never get to publish their frames.

## Verification

Pure Node checks cover projection tampering, protocol/base/duplicate guards,
frame rejection, draining a pending step, obsolete candidates, failed installation,
invalid documents, undo versions, layout edits during installation, resets,
failed resets, idle worker death, disposal and re-entrant state observers. Controlled
promises force the race order rather than relying on timing sleeps.

Real Chrome-worker checks verify initialization, projection revalidation, stale
requests without time advancement, stamped frames, reset epochs, layout reuse,
dropped delayed step responses, replacement output (2.5 V to 10/3 V), and safe reset.
A test wrapper injects failure after a real candidate successfully loads; snapshots
prove the old worker retains exactly its prior time/state and stays alive. Undo
then restores valid content at a new revision. The six original numerical fixtures
and all saved-document checks also run in the same suite.

## Next

Continuous scheduling and RC live switches are implemented; see RUN-AND-LIVE-EDITS.md.
Next build editor interactions against this boundary.
UI stack, broad model coverage, other browsers and deployment/CSP validation remain open.
