# New circuit simulator: project plan

Status: editor-free/worker proofs, stable-ID document boundary, continuous RC run
and first editor prototype verified, 2026-11-13. See [PHASE-0.md](PHASE-0.md) for
results and remaining feasibility work. Frontend/platform choices remain open.

The document/adapter contract is described in [EDITOR-DESIGN.md](EDITOR-DESIGN.md) and
[WORKER-PROTOCOL.md](WORKER-PROTOCOL.md), with concrete JSON examples. These are
partly implemented contracts with broader proposed scope. Document loading and stable-ID results are
implemented separately from the Phase 0 API; see [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md).
Revision gating and candidate-worker replacement/reset now run on that boundary;
see [COORDINATOR.md](COORDINATOR.md). Continuous scheduling and RC live edits are
also implemented: [RUN-AND-LIVE-EDITS.md](RUN-AND-LIVE-EDITS.md). Editor interaction
prototype is now implemented in [EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md).
The latest pass adds grid-aligned pins, ground-at-pin placement, explicit contacts,
branch-only dots and attached-wire backtracking fixes. Next: clarify separate Move
and Drag semantics, then inline insertion/wire cleanup. Frontend/platform choice
remains open.

## Purpose and agreed direction

Build a modern circuit editor with excellent component placement, wiring,
selection, navigation, and signal inspection. The main motivation is interaction
quality; simulation speed on complex circuits is secondary. The user's chosen
interaction reference is KiCad: quiet pin joins, precise grid contacts and dragging
that stretches connected wires. This preference does not select the UI toolkit.

Preserve CircuitJS's existing electrical algorithms and models where practical.
Do not make a simulation rewrite a prerequisite for the new interface. The user
is willing to undertake a substantial project and is interested in Rust and WASM,
inspired by https://github.com/tangency-labs/solidcraft.

Rust, browser-first delivery, the UI toolkit, and repository layout are proposals,
not final decisions. A separate application and an extracted engine are the
working architectural direction, subject to a feasibility investigation.

## Architecture to investigate

- Circuit document: stable component/pin IDs, explicit connectivity, parameters,
  and visual layout. Simulation results are separate from the saved document.
- Editor: selection, placement, wire editing, snapping, navigation, and reversible
  commands for undo/redo.
- Renderer: symbols, labels, interaction previews, probes, and waveforms.
- Engine adapter: translates the document into simulator inputs and maps results
  back to stable IDs. Numerical node indices must not become document identities.
- Existing CircuitJS engine: retain the Java-to-JavaScript implementation first;
  investigate background worker execution after identifying browser dependencies.

The existing engine derives connections partly from geometry. Explicit new-editor
connectivity therefore needs a tested translation; it is not an existing engine API.
Define parameter changes, switch events, topology changes, reset behaviour, and
stale-result handling explicitly. Transport results in batches rather than issuing
one cross-language call per component per simulation step.

## Phase 0: feasibility and decisions

1. Reproduce the current build and run representative circuits. Record toolchain
   versions and actual commands. README currently specifies Java 8 and Gradle 8.7.
2. Map the dependencies between SimulationManager, CircuitElm/component models,
   UIManager, loading, scopes, timing, and browser APIs. Identify global/static state.
3. Build the smallest proof that an external caller can load and advance a circuit
   and read results using the existing maths. A temporarily UI-hosted bridge is
   acceptable for discovery, but does not prove worker or headless operation.
4. Investigate deterministic stepping and capture baseline outputs from the
   unchanged simulator. Fix timestep, initial conditions, parameters, and sample
   times; choose justified tolerances for comparisons.
5. Compare frontend options with a small interaction prototype, including a Rust
   candidate. Check browser text/input, high-DPI rendering, trackpad interaction,
   accessibility, packaging, and compatibility with the engine bridge.
6. Record a decision covering target platforms, UI stack, bridge/extraction scope,
   licensing obligations for reused code, repository layout, and first component set.

Exit: a runnable engine bridge, a documented dependency map and limitations,
repeatable baseline capture, and an architecture decision supported by the spike.
Avoid broad refactoring before these questions are answered.

## Phase 1: engine boundary and verification

Extract only what the first working circuits require. Keep numerical changes
separate from structural changes. Expose load/reset, bounded stepping, parameter
updates, running state, result batches, and structured diagnostics.

Start reference coverage with a voltage divider, RC transient, RLC transient,
diode rectifier, and switch event. Add analytic checks where available, alongside
comparisons with the existing implementation. Existing behaviour is the
compatibility reference, not proof of physical accuracy for every circuit.

Exit: agreed sample circuits reproduce baseline results within documented
tolerances and the boundary can be driven independently of the old editor.

## Phase 2: first complete editing experience

Support sources, ground, resistors, capacitors, and wires. A user can build a
voltage divider and RC circuit, edit values, select and move groups, undo/redo,
save/reopen, run/pause/reset, and inspect voltage and a waveform.

Specify interaction rules before expanding features: click/Shift-click/marquee,
hit targets, zoom anchor, snapping, junctions versus crossings, connected movement,
wire bend editing, Escape, and cancellation. Keep input responsive during simulation.

Exit: those two circuits are pleasant to build and edit end to end, with verified
simulation results. Assess actual interaction quality, not just screenshots.

## Phase 3: broaden and harden

Expand models and CircuitJS import compatibility incrementally. Report unsupported
elements explicitly. Add larger-circuit measurement, error recovery, probes,
waveform tools, and desktop packaging if selected. Consider Rust engine ports only
when a demonstrated requirement justifies their validation cost.

## Working practices

- Keep the deployed fork usable while exploring the new application.
- Use focused branches and reviewable milestones; no deployment is implied.
- Update HANDOFF.md at session boundaries with changes, checks, blockers, and the
  next concrete task. Add dated decisions here or in a linked decision document.
- Share source, plans, fixtures, and setup instructions through Git. Keep generated
  output and machine-specific paths out of shared instructions.
- At machine changes, commit and push intended work, then fetch/pull on the other
  machine. Uncommitted local files do not transfer through Git.
