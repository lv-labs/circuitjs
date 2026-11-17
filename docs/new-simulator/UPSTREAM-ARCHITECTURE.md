# Upstream compatibility and repository architecture

Discussed 2026-11-17. This records the source audit and proposed direction; no
repository split or submodule conversion has been implemented. The editor cleanup
was subsequently completed as recorded below.

## Goal

Keep the React app and shared circuit core easy to develop while making updates
from original CircuitJS/Falstad repeatable and, where possible, automated. Preserve
upstream electrical models and algorithms. Full compatibility includes component
and property coverage, simulation behavior, and circuit import fidelity.

## Source audit

Compared the current `new-sim` working tree, including uncommitted edits, against
local `master` at `c2cd5dc2`. This isolates the new simulator work from the earlier
deployed-app reskin; it is not a complete audit against pristine upstream.
Counts are a dated snapshot, not ongoing coverage metrics.

| Changes under `src/` | Amount |
| --- | --- |
| Existing Falstad files modified | 12 |
| Lines added/removed in those files | 77 added, 20 removed |
| New integration/build files | 12 |
| Lines in new files | 1,081 |

The new-file total includes nine tracked files (963 lines) and three currently
untracked support classes (118 lines): `EngineDiodeSupport`, `EngineSwitchSupport`
and `EngineTransistorSupport`. Counts exclude React, shared JavaScript, tests,
documentation and Gradle changes.

Existing-file changes comprise:

- `CirSim` and `CircuitElm`: initialization and callbacks that work without the
  original interface.
- `SimulationManager`: null guards, a bounded stepping path using the retained
  numerical loop without UI pacing, and safe termination after a component stops.
- `AudioOutputElm`, `GateElm`, `LDRElm`, `OpAmpElm`, `PotElm`,
  `ThermistorNTCElm` and `VarRailElm`: avoid requiring widgets, menus, mouse or CSS
  while constructing and operating models in the worker.
- `AnalogSwitch2Elm`: matrix connectivity for either possible conducting throw.
- `LogicOutputElm`: declare the optional pulldown path to ground.

The solver and component equations have not been broadly rewritten. The new code
is principally engine entry points, construction/update/readout support, GWT
module definitions and a worker linker.

Older functional changes already on `master` also need a keep/drop decision:
potentiometers reaching their full range, ideal shorts at their endpoints, and AC
source defaults. Cosmetic reskin changes should be separated from these when
establishing a clean upstream baseline. The last locally identified upstream merge
is `45fe9103`; upstream has not been fetched or compared to its latest revision.

## What makes updates difficult

A clean Git merge does not expose a new upstream component in React. The engine
bridge deliberately restricts accepted records and has component-specific
construction and property handling. Our document catalog, pin mapping, editable
properties, symbols and fixtures must also support each model and variant.

There are therefore two update problems: carrying a small patch set over upstream
sources, and detecting/adapting changes to the component integration contract.
A submodule addresses source ownership and revision pinning, not the latter.

## Proposed architecture

Aim for a pinned upstream engine with a small, explicit patch layer. Keep custom
entry points and bridge classes outside the upstream source directory where the
Java/GWT build permits it; they can still use the required Java package. Confirm
this with a build rather than assuming physical separation removes coupling.
Keep component integration metadata centralized and generate only the parts that
can reliably be derived. React symbols and behavior still require intentional
implementation and verification.

Repository options:

| Option | Benefit | Cost |
| --- | --- | --- |
| Separated sources in this repository | Simple builds and coordinated edits | Deliberate upstream merging |
| Submodule referencing our engine fork | Explicit engine version and ownership | Another repository and integration branch |
| Pristine upstream submodule plus patches | Explicit upstream modifications | Patch maintenance on updates |

The audit makes pristine upstream plus a small patch layer plausible. Prove that
we can reproduce the current engine from a clean, pinned upstream checkout plus
isolated changes before choosing a submodule, engine fork or new application
repository. No repository move has been selected. Preserve history and notices.

A possible eventual layout is `apps/wires`, `packages/circuit-core`,
`packages/circuit-symbols`, `packages/circuit-runtime`, `engine`, `tests` and `docs`.
Folder renames are secondary to actual dependency boundaries.

## Cleanup and implementation sequence

1. Preserve the current working tree and inventory dependencies before removal.
   Retire the previous JavaScript editor after moving retained runtime/menu code
   to permanent homes. Do not delete `experiments/engine` wholesale: React imports
   `legacy-component-menu.js` and `component-menu.js`; its asset plugin ships
   `revision-worker.js`, `document-adapter.js` and `revision-protocol.js`, and the
   Gradle/fallback engine builds still copy that directory. Retain useful core,
   interaction and numerical tests; retire or port obsolete UI-specific tests.
2. Consolidate runtime/build paths and update docs/entry points so React is the
   active frontend. Keep the original Falstad interface available as a development
   reference for simulation and import comparisons. Distinguish that interface
   from our intermediate JavaScript editor.
3. Reconstruct a clean upstream baseline and separate required headless changes,
   correctness fixes and older intentional behavior changes into reviewable
   patches. Keep our additive bridge/build sources separate where practical.
4. Prove the current worker and app can build with that arrangement and preserve
   representative numerical behavior. Only then decide repository/submodule form.
5. Establish import fixtures from the bundled Falstad examples. Translate its
   coordinate-based connectivity into our explicit graph; cover flags, model and
   subcircuit definitions, scopes and unsupported records. Report unsupported
   content explicitly. Record component coverage, simulation agreement and import
   fidelity separately; catalog type presence is not successful import coverage.
6. Add an upstream-update workflow that proposes a pinned revision update, applies
   patches, compiles the worker, runs focused numerical/import regression fixtures,
   and reports added/changed component types and integration gaps. Treat successful
   checks as evidence for review, not proof of universal compatibility. Routine
   updates may become largely automatic; new components may still need authored
   symbols, metadata, property mappings and tests.

## Decisions and limits

The user wants cleanup before expanding compatibility and is exploring easier
upstream maintenance. The architecture above is a proposal, not authorization to
publish, create another repository or switch dependency strategy. This document
records inspection only; no new build, numerical or browser verification was run
for this discussion. Existing uncommitted implementation work must be preserved.

## Cleanup implemented — 2026-11-17

The intermediate JavaScript editor and scope renderer are removed. Workers moved
to `packages/circuit-runtime`, menus to `wires/src/editor/menu`, and retained
verification assets/test adapters to `tools/engine-harness`. React's worker uses
core modules directly. Build assembly clears stale files, and the React bundle
has no dependency on the harness. The original Falstad interface is retained.
The remaining architectural proposals above are still future work.

## Maintenance follow-up — 2026-11-17

Plan/handoff checkpoints are archived with concise current entry points and a
separate `EDITOR-CONTRACT.md`. Node tests now use the public core and active React
symbol/export/slider-property modules, with obsolete prototype helpers removed.
Fixtures reflect current geometry and model parameters. Root pnpm scripts and
separate React/engine CI provide a repeatable non-browser check path; the existing
Falstad deployment is unchanged. This completes the preparatory maintenance
pass, not the proposed upstream source separation or importer.
