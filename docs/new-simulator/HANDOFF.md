# New simulator: current handoff

Updated 2026-11-17. Read [PLAN.md](PLAN.md) and
[EDITOR-CONTRACT.md](EDITOR-CONTRACT.md) next. Earlier implementation notes and the
full pre-cleanup handoff are in [HANDOFF-HISTORY.md](HANDOFF-HISTORY.md); their
old priorities, paths and verification restrictions are historical.

## Workspace and contract

Work in `circuitjs-new-sim` on `new-sim`. The neighboring `circuitjs` checkout is
`master`. React in `wires/` is the active new editor; the separate Vite
`/editor.html` entry is still a supported fixture preview. The intermediate
JavaScript editor/scope renderer and its DOM-specific browser runners are removed.
The original Falstad Java/GWT app remains available through `makeSite` and the
existing deployment workflow. No submodule/repository conversion has occurred.

Preserve all local React, symbol, core and Java work. The UI uses React/TypeScript,
shadcn Base Mira and SVG; computation remains JavaScript plus the existing
CircuitJS worker/solver. Do not embed or restore the old frontend. Keep stable
IDs, explicit graph connectivity and exact history behavior. Accepted scope,
slider, meter and interaction contracts are in [EDITOR-CONTRACT.md](EDITOR-CONTRACT.md).
No browser verification unless requested; headless checks do not certify pointer
behavior. No subagents are needed for this work.

## Source ownership

| Location | Responsibility |
| --- | --- |
| `wires/src/editor` | React editor, session lifecycle, file/UI behavior, property controls |
| `wires/src/editor/menu` | Generated Falstad hierarchy and supported-placement mapping |
| `packages/circuit-symbols/src` | One authored TSX metadata/view per symbol |
| `packages/circuit-core` | Document validation, graph editing/history, compiler/protocol, simulation coordination and sampled signals |
| `packages/circuit-runtime` | Direct engine, document and revision worker entry points |
| `src`, `war`, `build.gradle` | Retained Java/GWT models, original interface, engine compilation |
| `tools/engine-harness` | Development engine demos, browser verification and historical numerical traces |
| `tools/test_*.mjs` | Direct public-core and active React module regression checks |
| `wires/scripts/engine-assets.ts` | Serve/package runtime, core and compiled worker for React |

Node tests no longer depend on prototype global adapters. Three small browser
harness adapters (`document-adapter`, `simulation-coordinator`, `revision-client`)
remain because verification/demo pages use them. Old output/slider/orientation
implementations and unused `worker-api.js` are removed. Both engine-site assembly
paths clear stale output. React production does not ship the harness.

## Build and check

Requirements: Java 8, the Gradle wrapper, Node 24+ and pnpm 10.30.3. Root scripts
orchestrate the existing `wires` package; dependencies and lockfile stay there.

```sh
pnpm deps:install       # install React dependencies from wires/pnpm-lock.yaml
pnpm engine:build       # compile Java/GWT and assemble build/engine-site
pnpm dev               # start React; use the printed URL
pnpm build             # fresh engine plus React production build
pnpm check             # core suites, React build, SSR and packaged-worker checks
pnpm verify            # fresh engine followed by all non-browser checks
```

Use `pnpm --dir wires build` for a frontend-only build with an existing compiled
worker. React output is `wires/dist`; original deployment output is `site`.
`pnpm --dir wires typecheck` checks both TypeScript projects. Regenerate authored
symbol metadata with `pnpm --dir wires symbols:generate`, and menu hierarchy with
`python3 tools/generate_component_menu.py`.

If sandbox sockets block Gradle/GWT external workers, the offline cached fallback
works with an existing JDK/GWT cache using in-process permutation workers:

```sh
JAVA_TOOL_OPTIONS=-Dgwt.jjs.permutationWorkerFactory=com.google.gwt.dev.ThreadedPermutationWorkerFactory \
  python3 tools/build_engine_cached.py --java-home /path/to/jdk8 --cache /path/to/gradle/caches/modules-2/files-2.1
```

`.github/workflows/react.yml` checks `new-sim` pushes and PRs targeting
`master`, `dev` or `new-sim`: Node/pnpm installation, engine compilation, core
checks and React rendering/worker packaging. It does not deploy. Existing original
Falstad build/deployment workflows are unchanged.

## Maintenance changes and validation

This pass archives the long plan/handoff, removes obsolete test dependencies and
uses the active TSX orientation, TypeScript capture and slider-property modules.
Geometric fixtures now reflect the 50-unit grid and authored pin directions;
component-count checks compare public entry points instead of freezing a count.
SPDT third-position fixtures explicitly enable center-off. MOS cutoff fixtures
isolate the channel from the separately tested body diode; diode fixtures use
current named-model parameters. Electrical regression expectations remain in place.
The production solver and existing editor implementations were not rewritten.

Validation for this pass:

- All 33 computational suites passed, including the current editor/core tests,
  96 pin-drag cases, 120 rotation/flip cases and 400 seeded drag offsets.
- React production build passed: 84-symbol metadata check, both TypeScript
  projects and both Vite entries. SSR divider and packaged worker divider/RC
  checks passed. The existing Vite large-chunk warning remains.
- Reassembled `build/engine-site` from the cached fallback's assembly code using
  the previously fresh engine; retired helpers/assets are absent. No Java source
  changed during this maintenance pass. Default Gradle remains blocked by local
  sandbox sockets; its updated assembly and the hosted CI have not run here.
- Current docs links, package JSON, CI YAML and changed-file whitespace checked.
  130 pre-existing production implementation files matched the pre-pass snapshot
  byte-for-byte. No browser interaction verification was performed.

Historical failures (`200 !== 192`, `84 !== 65`) are resolved through current
fixtures. Root `.vite/` is ignored. Nothing was committed or deployed.

## Next work and known limits

Follow [UPSTREAM-ARCHITECTURE.md](UPSTREAM-ARCHITECTURE.md) to prove the upstream
patch boundary, then continue measured Falstad component/property/import coverage.
No general text importer or bundled-library chooser exists. Bus/hierarchical
objects and many variants are unsupported. Frequency/period, triggering/FFT,
large-scene/platform coverage and desktop packaging remain open. Scope layout is
saved in circuit JSON; property-slider configuration remains local to each circuit.
User-reported scope navigation improved, but no benchmark/browser parity is claimed.

Use [REACT-PARITY.md](REACT-PARITY.md), [PROPERTY-PARITY.md](PROPERTY-PARITY.md),
[LEGACY-CATALOG.md](LEGACY-CATALOG.md), [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md),
[COORDINATOR.md](COORDINATOR.md) and [WORKER-PROTOCOL.md](WORKER-PROTOCOL.md) for
coverage and contracts. Dated prototype design reports are historical context.
