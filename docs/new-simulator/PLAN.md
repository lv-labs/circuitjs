# New circuit simulator: current plan

Updated 2026-11-17. Read [HANDOFF.md](HANDOFF.md) for build/check status and
[EDITOR-CONTRACT.md](EDITOR-CONTRACT.md) for accepted interaction requirements.
Previous milestones and the complete pre-cleanup plan are in
[PLAN-HISTORY.md](PLAN-HISTORY.md); historical instructions there are superseded.

## Direction

Complete Falstad functionality in the React/TypeScript app (`wires/`), retaining
CircuitJS electrical models and solver algorithms. Use shadcn Base Mira for the
shell and SVG for the sheet. Preserve the accepted interface, stable document
identities, explicit connectivity and authored per-symbol TSX metadata/views.
The JavaScript editor prototype is retired. Original Falstad remains a separate
development reference and the existing deployed application.

## Current state

| Area | Implemented | Remaining |
| --- | --- | --- |
| Engine | Editor-free Java/GWT worker, bounded stepping, stable-ID results, state-preserving live edits | Complete model/variant coverage and larger-circuit/platform verification |
| Editor | React menus, properties, file/history/clipboard actions, connected dragging, detached transforms, explicit wiring | Remaining native Falstad behavior and browser verification |
| Library | 84 authored models, including 3 graphics; generated core metadata | Unsupported components and variants; see catalog/property audits |
| Inspection | Per-step voltage/current sampling, meters, captures, saved mixed dock/floating/sheet scopes | Frequency/period, triggering/FFT, interactive verification |
| Documents | Schema v1, explicit graph, JSON save/open/autosave, scope workspace persistence | General Falstad text importer, bundled-example chooser, migration policy |
| Maintenance | React runtime separated from verification harness; direct core test imports; current tests and build commands | Clean upstream baseline and patch-boundary proof |

## Next work

1. **Establish an upstream boundary.** Follow
   [UPSTREAM-ARCHITECTURE.md](UPSTREAM-ARCHITECTURE.md): reconstruct the pinned
   baseline, separate headless hooks/correctness fixes/older intentional behavior
   changes, and prove the current worker builds from clean upstream plus isolated
   additions/patches. A submodule, engine fork or new repository remains undecided.
2. **Expand measured compatibility.** Use [LEGACY-CATALOG.md](LEGACY-CATALOG.md),
   [PROPERTY-PARITY.md](PROPERTY-PARITY.md) and [REACT-PARITY.md](REACT-PARITY.md).
   Track component/property coverage, numerical behavior and import fidelity
   separately. Preserve current UX and original equations.
3. **Implement explicit legacy import.** Start with a measured subset of bundled
   circuits; translate coordinate connectivity, flags, definitions/subcircuits,
   models and scopes into the explicit document graph. Diagnose unsupported
   records instead of dropping content. Type coverage alone is not import success.
4. **Automate upstream proposals.** Compile/test pinned revision updates and
   report added or changed model integration gaps. New Java components still need
   document/property mappings, authored symbols and verification.

## Maintenance checkpoint

- Workers: `packages/circuit-runtime`; shared computation: `packages/circuit-core`.
- Menus: `wires/src/editor/menu`; symbols: `packages/circuit-symbols`.
- Engine demos/reference traces: `tools/engine-harness`; no React dependency.
- Node tests import the public core directly; symbol/export/slider-property checks
  exercise active React modules. Prototype-only helpers and adapters are removed.
- Root `pnpm` commands cover dependency installation, engine/React builds and
  checks. React CI is separate from the original Falstad deployment.
- Full previous plan/handoff snapshots are archived; keep these entry points short
  and record current findings rather than accumulating superseded instructions.

## Guardrails and deferred decisions

Preserve local changes. Keep solver changes separate from structural cleanup and
frontend work. Keep generated symbol metadata fresh; pin identities and native
engine post order are distinct. Scope display must not change sampling cadence.
Save/open and undo must preserve the explicit graph and saved workspace.

No renderer rewrite, Rust/GPUI migration or solver rewrite is planned. Desktop
packaging (Tauri/Electron/platforms), schema migration policy and repository split
remain undecided. Custom simulation-time control events/ramps, analysis tools and
automation APIs follow native Falstad compatibility; existing manual property
sliders remain supported. Do not launch browser verification unless requested.
